import Page from '@components/Page';
import CharacterCreateForm from '@components/Character/CharacterCreateForm';

const CharacterCreatePage = () => (
    <Page title="Create Character - SIGNArank" description="Create your on-chain Character on SignaRank.">
        <div className="content max-w-lg mx-auto py-8 px-4">
            <CharacterCreateForm />
        </div>
    </Page>
);

export default CharacterCreatePage;
