export class ExceptionInactiveAccount extends Error {
    constructor(accountId: string) {
        super(`Account ${accountId} is inactive`)
    }

}
