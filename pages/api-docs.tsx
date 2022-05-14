import Page from '../components/Page';
import {isClientSide} from '@lib/isClientSide';

const APIDocs = () => {

  const hostName = isClientSide() ? location.origin : ''

  return <Page title="SignaRank - Endpoint API Documentation">
    <div className="content">
      <div>
        <h3>SignaRank Endpoint Documentation</h3>

        <h4 style={{marginTop: '2rem'}}>Get SignaRank and Score for a Single Address</h4>
        <p>Returns the SignaRank and score of a given address in JSON format.</p>
        <pre>
            {hostName}{`/api/score/:accountId`}
        </pre>
        <p>Try this endpoint in your <a href="api/score/16107620026796983538" rel="noreferrer noopener" target="_blank">browser 🔗</a>.</p>
        <h5>Sample Response</h5>
        <pre>
            {`{"score":300,"rank":25}`}
        </pre>
        <hr style={{margin: '2rem 0', borderColor: 'darkgray'}}/>
        <h4>Get Leaderboard </h4>
        <p>Returns the current leaders in JSON format.</p>
        <pre>
            {hostName}{`/api/leaderboard`}
        </pre>
        <p>Try this endpoint in your <a href="api/leaderboard" rel="noreferrer noopener" target="_blank">browser 🔗</a>.</p>
        <h5>Sample Response</h5>
        <pre>
            {`{
    "leaderboard": [
        {
            "address": "2402520554221019656",
            "score": 365
        }, 
        ...
    ],
    "latestScores": [
        {
            "address": "6502115112683865257",
            "score": 220
        },
        ...
    ]
}`}
        </pre>

      </div>
    </div>
  </Page>
}

export default APIDocs
