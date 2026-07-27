import Page from '@components/Page';
import CharacterCreateWizard from '@components/Character/CreateWizard/CharacterCreateWizard';

const CharacterCreatePage = () => (
    <Page title="Create Character - SIGNArank" description="Create your on-chain Character on SignaRank.">
        <div className="content max-w-lg mx-auto py-8 px-4">
            <CharacterCreateWizard />
        </div>
    </Page>
);

export default CharacterCreatePage;
