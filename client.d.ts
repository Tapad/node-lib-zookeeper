import { Client as ZkClient } from "node-zookeeper-client";
export interface ClientOptions {
    retryCount?: number;
    retryWait?: number;
    connectTimeout?: number;
    sessionTimeout?: number;
}
export declare const DEFAULT_CLIENT_OPTIONS: ClientOptions;
export declare class Client {
    readonly underlying: ZkClient;
    readonly options: ClientOptions;
    readonly basePath: string;
    readonly version: string;
    constructor(connectionString: string, options?: ClientOptions);
    announce(serviceId: string, address: string, port: number, data?: any): Promise<void>;
    private mkdirp(path);
    private registerService(path, data);
    private getInstancePath(path);
}
