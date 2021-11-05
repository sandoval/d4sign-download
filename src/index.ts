import 'dotenv/config';
import request from 'request';
import download from 'download';
import { D4Document } from './entity/D4Document';
import { D4DocumentLink } from './entity/D4DocumentLink';
import * as fs from 'fs';
import { decode } from 'html-entities';
import queue from 'queue';

let tokenAPI = process.env.TOKEN_API;
let cryptKey = process.env.CRYPT_KEY;
let dest = "contratos/";
var totalCount = 0;
var timeoutCount = 0;
let q = queue({
    concurrency: 50,
    timeout: 60000,
    autostart: false,
    results: []
});

const listDocuments = async (): Promise<D4Document[]> =>
{
    return new Promise(function (resolve, reject)
    {
        var options = {
            'method': 'GET',
            'url': 'https://secure.d4sign.com.br/api/v1/documents?tokenAPI=' + tokenAPI + '&cryptKey=' + cryptKey,
        };
        request(options, (error, response) => {
            if (error) {
                reject(new Error(error))
            } else {
                var result: Object[] = JSON.parse(response.body);
                // TODO: treat pagination in case of multiple pages.
                resolve(result.slice(1).map((obj) => D4Document.fromObject(obj)));
            }
        });
    });
}

const getDocumentLink = async (uuid: string): Promise<D4DocumentLink> =>
{
    return new Promise(function (resolve, reject)
    {
        var options = {
            'method': 'POST',
            'url': 'https://secure.d4sign.com.br/api/v1/documents/' + uuid + '/download?tokenAPI=' + tokenAPI + '&cryptKey=' + cryptKey,
            formData: {
                'type': 'pdf'
            }
        };
        request(options, (error, response) => {
            if (error) {
                console.error(error);
                reject(new Error(error));
            } else {
                resolve(D4DocumentLink.fromObject(JSON.parse(response.body)));
            }
        });
    });
}

class DownloadResult
{
    uuid: string;
    path: string;
    success: boolean;
    status: 'alreadyDownloaded' | 'downloaded' | 'failed' | 'notFound' | 'canceled' | 'rateLimited';

    constructor(uuid: string, path: string, success: boolean,
        status: 'alreadyDownloaded' | 'downloaded' | 'failed' | 'notFound' | 'canceled' | 'rateLimited')
    {
        this.uuid = uuid;
        this.path = path;
        this.success = success;
        this.status = status;
    }
}

const decodeHtmlEntities = (str: string): string =>
{
    // return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return decode(str);
}

const downloadDocument = async (doc: D4Document, link: D4DocumentLink): Promise<DownloadResult> =>
{
    const path = dest + decodeHtmlEntities(doc.safeName);
    const filename = doc.uuidDoc + "-" + decodeHtmlEntities(link.name) + ".pdf";
    if (!fs.existsSync(path)) {
        fs.mkdirSync(path, { recursive: true });
    } else {
        const files = fs.readdirSync(path);
        if (files.find((file) => file.startsWith(doc.uuidDoc))) {
            return new DownloadResult(doc.uuidDoc, path + "/" + filename, true, 'alreadyDownloaded');
        }
    }
    if (link.url != '') {
        try {
            await download(link.url, path, { filename: filename });
            return new DownloadResult(doc.uuidDoc, path + "/" + filename, true, 'downloaded');
        } catch {
            return new DownloadResult(doc.uuidDoc, path + "/" + filename, false, 'failed');
        }
    } else if (link.error == 'Esta chave da API já atingiu o tempo limite para este método') {
        return new DownloadResult(doc.uuidDoc, path + "/" + filename, false, 'rateLimited');
    } else {
        return new DownloadResult(doc.uuidDoc, path + "/" + filename, false, 'notFound');
    }
}

const getLinkAndDownload = async (doc: D4Document): Promise<DownloadResult> =>
{
    try {
        if (doc.wasCanceled()) {
            return new DownloadResult(doc.uuidDoc, decodeHtmlEntities(doc.nameDoc), true, 'canceled');
        }
        const link = await getDocumentLink(doc.uuidDoc);
        return downloadDocument(doc, link);
    } catch {
        return new DownloadResult(doc.uuidDoc, "", false, "failed");
    }
}

var rateLimited = 0;
let timeStart = new Date();
const printUpdate = () =>
{
    var duration = (Date.now() - timeStart.valueOf()) / 1000;
    var results: DownloadResult[] = [];
    if (q.results != null) {
        q.results.forEach(arr => {
            if (arr != null) {
                arr.forEach((obj: DownloadResult) => results.push(obj));
            }
        });
    }
    var successCount = 0;
    var alreadyDownloadedCount = 0;
    var failedCount = 0;
    var canceledCount = 0;
    rateLimited = 0;
    results.forEach((res: DownloadResult) =>
    {
        if (res.success) {
            successCount += 1;
        } else {
            failedCount += 1;
        }
        if (res.status == 'alreadyDownloaded') {
            alreadyDownloadedCount += 1;
        } else if (res.status == 'canceled') {
            canceledCount += 1;
        } else if (res.status == 'rateLimited') {
            rateLimited += 1;
        }
    });
    console.log(`\nRunning for ${duration}s.\nTotalCount: ${totalCount}\nTimeout: ${timeoutCount}\nRemaining: ${q.length}\nSuccess: ${successCount}\nFailed: ${failedCount}\nAlready downloaded: ${alreadyDownloadedCount}\nCanceled: ${canceledCount}\nRate Limited: ${rateLimited}`);
}

var watchdog = setInterval(printUpdate, 15000);

const main = async () =>
{
    console.log("Starting process.");
    let documents = await listDocuments();
    if (!watchdog.hasRef()) {
        watchdog = setInterval(printUpdate, 15000);
    }

    console.log("Document list loaded.");
    documents.forEach(doc => {
        q.push(() => {
            return getLinkAndDownload(doc);
        });
    });

    totalCount = q.length;
    timeoutCount = 0;

    q.on('timeout', (next, job) => {
        console.log("Job timed out: " + job.toString());
        timeoutCount += 1;
        next();
    });

    q.start(err => {
        clearInterval(watchdog);
        watchdog.unref();

        watchdog.unref();
        if (err) {
            console.error(err);
        } else {
            console.log("Task finished.");
            printUpdate();
            if (rateLimited > 0) {
                console.log(`There are still ${rateLimited} documents blocked due to rate limiting. Trying again in 10 minutes.`);
                setTimeout(main, 10 * 60 * 1000);
            } else {
                console.log("Done downloading! Thank you :)");
            }
        }
    });
}

main();
