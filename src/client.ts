import { Client as ZkClient, CreateMode, createClient } from "node-zookeeper-client";

export interface ClientOptions {
	retryCount?: number;
	retryWait?: number;
	connectTimeout?: number;
	sessionTimeout?: number;
}
export const DEFAULT_CLIENT_OPTIONS: ClientOptions = {
	retryCount: 5,
	retryWait: 1000,
	connectTimeout: 1000,
	sessionTimeout: 10000
};

export class Client {
	readonly underlying: ZkClient;
	readonly options: ClientOptions;

	readonly basePath: string = "services";
	readonly version: string = "v1";

	constructor(connectionString: string, options?: ClientOptions) {
		this.options = Object.assign({}, DEFAULT_CLIENT_OPTIONS, options);

		this.underlying = createClient(connectionString, {
			retries: this.options.retryCount!,
			spinDelay: this.options.retryWait!,
			sessionTimeout: this.options.sessionTimeout!
		});
		this.underlying.connect();
	}

	announce(serviceId: string, address: string, port: number, data?: any): Promise<void> {
		const servicePath: string = `/${ this.basePath }/${ serviceId }/${ this.version }`;

		const zkData: any = {
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

	private mkdirp(path: string): Promise<string> {
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

	private registerService(path: string, data: any): Promise<void> {
		return this.getInstancePath(path).then((instancePath) => {
			return new Promise<void>((resolve, reject) => {
				let bufferedData: Buffer | undefined;
				if (data != null) {
					bufferedData = new Buffer(JSON.stringify(data));
				}
				this.underlying
					.transaction()
					.create(instancePath, bufferedData, undefined, CreateMode.EPHEMERAL)
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

	private getInstancePath(path: string): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			const attempt: () => void = () => {
				const id: string = "member_" + randomInt(),
					instancePath: string = `${ path }/${ id }`;

				this.underlying.exists(instancePath, () => { /* noop */ }, (err, stat) => {
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

function randomInt(): string {
	const n: number = Math.random() * ~(1 << 31) | 0,
		s: string = String(n);
	return Array(10 - s.length).fill("0").join("") + s;
}
