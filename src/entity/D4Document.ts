export class D4Document
{
    uuidDoc: string = "";
    nameDoc: string = "";
    type: string = "";
    size: string = "";
    pages: string = "";
    uuidSafe: string = "";
    safeName: string = "";
    statusId: string = "";
    statusName: string = "";
    statusComment: string | null = null;
    whoCanceled: string | null = null;

    public wasCanceled(): Boolean
    {
        return this.statusId == "6";
    }

    static fromObject(obj: Object): D4Document
    {
        return Object.assign(new D4Document(), obj);
    }
}
