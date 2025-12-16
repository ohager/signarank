import { useRouter } from 'next/router'
import { useEffect } from 'react';
import { GetStaticProps, GetStaticPaths } from 'next';
import Page from '../../components/Page';
import {ISR_REVALIDATE_SECONDS} from '@lib/cacheConfig';

// Generate on-demand with ISR (fallback: blocking)
export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [], // Generate on-demand
    fallback: 'blocking'
  };
};

export const getStaticProps: GetStaticProps = async ({params}) => {
  const unstoppableName = params?.unstoppableName;

  if (typeof unstoppableName !== 'string') {
    return { notFound: true };
  }

  const { address, error } = await lookupUnstoppableName(unstoppableName);

  return {
    props: {
      address,
      unstoppableName,
      error,
    },
    revalidate: ISR_REVALIDATE_SECONDS
  }
}

export interface UnstoppableProps {
  address: string,
  unstoppableName: string,
  error: boolean | string
}

const UnstoppableRedirect = ({ address, unstoppableName, error }: UnstoppableProps) => {

  const router = useRouter()

  useEffect(() => {
    if (error || !address.length) {
      router.push('/error');
    } else {
      router.push(`/address/${address}?ud=${unstoppableName}`);
    }
  });

  return <Page title="ETHRank">
    <div className="content">
      <h2 className="gradient-box gradient-bottom-only">Redirecting, please wait...</h2>
    </div>
  </Page>
}

export default UnstoppableRedirect

export async function lookupUnstoppableName(unstoppableName: string) {
  let address = '';
  let error = false;
  if (unstoppableName && typeof unstoppableName === "string") {

    const res = await fetch(`https://unstoppabledomains.com/api/v1/${unstoppableName}`);
    const resJson = await res.json();

    if (resJson && resJson.meta && resJson.meta.owner) {
      address = resJson.meta.owner;
    } else {
      error = true;
    }
  }
  return { address, error };
}
