export class ExceptionInvalidAddress extends Error {
    constructor(invalidAddress: string) {
        super(`Invalid Address received: ${invalidAddress}`);
    }
}
