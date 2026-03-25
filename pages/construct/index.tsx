import {useEffect} from 'react';
import {useRouter} from 'next/router';
import {getActiveConstructId} from '@lib/construct/constants';
import Page from '@components/Page';

const ConstructIndexPage = () => {
    const router = useRouter();
    const activeContractId = getActiveConstructId();

    useEffect(() => {
        if (activeContractId) {
            router.replace(`/construct/${activeContractId}`);
        }
    }, [activeContractId, router]);

    if (!activeContractId) {
        return (
            <Page title="No Active Construct - SIGNArank">
                <div className="content-area">
                    <div className="glass-static p-12 flex flex-col justify-center items-center min-h-[300px] text-center gap-4">
                        <h2
                            className="text-[1.4rem] font-semibold text-[var(--ember)]"
                            style={{fontFamily: "'Cinzel', serif"}}
                        >
                            No Active Construct
                        </h2>
                        <p
                            className="text-[var(--text-dim)]"
                            style={{fontFamily: "'Cormorant Garamond', serif"}}
                        >
                            No construct is currently configured.
                        </p>
                    </div>
                </div>
            </Page>
        );
    }

    return (
        <Page title="Redirecting... - SIGNArank">
            <div className="content-area">
                <div className="glass-static p-12 flex justify-center items-center min-h-[300px]">
                    <span
                        className="text-[var(--text-dim)] text-lg"
                        style={{fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic'}}
                    >
                        Redirecting to active construct...
                    </span>
                </div>
            </div>
        </Page>
    );
};

export default ConstructIndexPage;
