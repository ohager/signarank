import type {TransactionObj} from "signum-smartc-testbed";
import {Context} from "../context";


export const InitialTransactions: TransactionObj[] = [
    {
        blockheight: 1,
        amount: 200_0000_0000n, // charge
        sender: Context.CreatorAccount,
        recipient: Context.ThisContract,
    },
]


export const CreatorConfiguration: TransactionObj[] = [
    ...InitialTransactions,
    {
        blockheight: 2,
        amount: Context.ActivationFee,
        sender: Context.CreatorAccount,
        messageArr: [Context.Methods.SetBoni, 1000_0000_0000n, 5000_0000_0000n],
        recipient: Context.ThisContract,
    },
]
