export class D4DocumentLink
{
    url: string = "";
    name: string = "";
    status: boolean = false;
    error: string = "";

    static fromObject(obj: Object): D4DocumentLink
    {
        return Object.assign(new D4DocumentLink(), obj);
    }
}