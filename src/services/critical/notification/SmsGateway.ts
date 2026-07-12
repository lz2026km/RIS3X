export class SmsGateway { send(to: string, msg: string): Promise<boolean> { return Promise.resolve(true); } }
