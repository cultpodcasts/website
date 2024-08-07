import { IAuth0 } from "./IAuth0";


export interface IEnvironment {
    auth0: IAuth0;
    api: string;
    assetHost: string;
    shortner: string;
    name: string;
}