import AmbassadorInvitationAcceptance from './AmbassadorInvitationAcceptance';

export default async function AmbassadorInvitationAcceptancePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = '' } = await searchParams;
  return <AmbassadorInvitationAcceptance token={token} />;
}
