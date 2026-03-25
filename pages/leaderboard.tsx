import {prisma} from '@lib/prisma';
import {User} from '@lib/User.interface';
import Page from '../components/Page';
import {useAddressPrefix} from '@hooks/useAddressPrefix';
import {Address} from '@signumjs/core';
import {GetStaticProps} from 'next';
import {ISR_REVALIDATE_SECONDS} from '@lib/cacheConfig';
import {getExplorerBaseUrl} from '@lib/explorerUrl';


// ISR: Statically generate leaderboard and regenerate every 30 minutes
export const getStaticProps: GetStaticProps = async () => {
    const leaderboard = await prisma.address.findMany({
        take: 100,
        where: {
            active: true
        },
        orderBy: {
            score: 'desc'
        }
    });

    return {
        props: {
            leaderboard: JSON.stringify(leaderboard),
            explorerBaseUrl: getExplorerBaseUrl(),
        },
        revalidate: ISR_REVALIDATE_SECONDS
    };
}

interface LeaderboardParams {
    leaderboard: any,
    explorerBaseUrl: string
}

const Leaderboard = ({leaderboard, explorerBaseUrl}: LeaderboardParams) => {
    const prefix = useAddressPrefix()
    const leaders = JSON.parse(leaderboard);
    return <Page title="SIGNArank - Leaderboard">
        <div className="content">
            <div>
                <h3>Leaderboard</h3>
                <ol className="grid grid-cols-[48%_48%] text-center gap-y-[30px] gap-x-[6%] justify-items-center box-content">
                    {leaders.map((user: User, i: number) => {
                        const displayName = Address.create(user.address, prefix).getReedSolomonAddress();
                        const addressExplorerUrl = `${explorerBaseUrl}/address/${user.address}`
                        return <li key={i} className="user [&_h4]:inline-block [&_h4]:w-4/5 [&_h4]:my-[10px] [&_h4]:mb-[-4px] [&_h4]:overflow-hidden [&_h4]:text-ellipsis [&_h4]:py-px [&_h4]:pl-[10px] [&_h4]:pr-[25px]">
                            <h4>
                                <a className="explorer-link" href={addressExplorerUrl} target="_blank" rel="noreferrer noopener">🌐 </a>
                                <a href={`/address/${user.address}`}>{displayName}</a>
                            </h4>
                            <span>{user.score}</span>
                        </li>
                    })}
                </ol>
            </div>
        </div>
    </Page>
}

export default Leaderboard
