import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getActiveConstructId } from '@lib/construct/constants';
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
                <div className="max-w-[1400px] mx-auto p-8 max-lg:p-6 max-md:p-4">
                    <div className="flex flex-col justify-center items-center min-h-[400px] text-red-500 text-center gap-4">
                        <h2>No Active Construct</h2>
                        <p>No construct is currently configured.</p>
                    </div>
                </div>
            </Page>
        );
    }

    return (
        <Page title="Redirecting... - SIGNArank">
            <div className="max-w-[1400px] mx-auto p-8 max-lg:p-6 max-md:p-4">
                <div className="flex justify-center items-center min-h-[400px] text-white text-xl">
                    Redirecting to active construct...
                </div>
            </div>
        </Page>
    );
};

export default ConstructIndexPage;
