"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_zookeeper_client_1 = require("node-zookeeper-client");
exports.DEFAULT_CLIENT_OPTIONS = {
    retryCount: 5,
    retryWait: 1000,
    connectTimeout: 1000,
    sessionTimeout: 10000
};
class Client {
    constructor(connectionString, options) {
        this.basePath = "services";
        this.version = "v1";
        this.options = Object.assign({}, exports.DEFAULT_CLIENT_OPTIONS, options);
        this.underlying = node_zookeeper_client_1.createClient(connectionString, {
            retries: this.options.retryCount,
            spinDelay: this.options.retryWait,
            sessionTimeout: this.options.sessionTimeout
        });
        this.underlying.connect();
    }
    announce(serviceId, address, port, data) {
        const servicePath = `/${this.basePath}/${serviceId}/${this.version}`;
        const zkData = {
            serviceEndpoint: {
                host: address,
                port: port
            },
            additionalEndpoints: {},
            status: "ALIVE"
        };
        if (data != null) {
            zkData.data = data;
        }
        return this.mkdirp(servicePath).then(() => {
            return this.registerService(servicePath, zkData);
        });
    }
    // TODO: watch, unregister, getChildren/data something
    mkdirp(path) {
        return new Promise((resolve, reject) => {
            this.underlying.mkdirp(path, (err, createdPath) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(createdPath);
            });
        });
    }
    registerService(path, data) {
        return this.getInstancePath(path).then((instancePath) => {
            return new Promise((resolve, reject) => {
                let bufferedData;
                if (data != null) {
                    bufferedData = new Buffer(JSON.stringify(data));
                }
                this.underlying
                    .transaction()
                    .create(instancePath, bufferedData, undefined, node_zookeeper_client_1.CreateMode.EPHEMERAL)
                    .commit((err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });
        });
    }
    getInstancePath(path) {
        return new Promise((resolve, reject) => {
            const attempt = () => {
                const id = "member_" + randomInt(), instancePath = `${path}/${id}`;
                this.underlying.exists(instancePath, () => { }, (err, stat) => {
                    if (err) {
                        reject(err);
                    }
                    if (stat) {
                        attempt();
                        return;
                    }
                    resolve(instancePath);
                });
            };
            attempt();
        });
    }
}
exports.Client = Client;
function randomInt() {
    const n = Math.random() * ~(1 << 31) | 0, s = String(n);
    return Array(10 - s.length).fill("0").join("") + s;
}
