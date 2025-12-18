import type {TransactionObj} from "signum-smartc-testbed";
import {Context} from "../context";


export const BootstrapScenario: TransactionObj[] = [
    {
        blockheight: 1,
        amount: 200_0000_0000n, // charge
        sender: Context.CreatorAccount,
        recipient: Context.ThisContract,
        tokens: [
            {asset: Context.XPTokenId, quantity: 50_000n}
        ]
    }
]
