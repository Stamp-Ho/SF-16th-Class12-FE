'use server';
/**
 * mattermost webhook test
 */
export const testHook = async ({ username }: { username: string }) => {
	const webhookUrl = process.env.MATTERMOST_CLASS_WEBHOOK;
	console.log('webhookUrl:', webhookUrl);
	if (!webhookUrl) {
		throw new Error('매터모스트 클래스 웹훅이 정의되지 않았습니다.');
	}
	const userId: string = MATTERMOST_USER_IDS[username];
	if (!userId) {
		throw new Error(
			`"${username}"의 매터모스트 사용자 ID가 정의되지 않았습니다.`,
		);
	}
	const message = `테스트용`;
	try {
		const response = await fetch(webhookUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				channel: userId,
				text: message,
			}),
		});
		if (!response.ok) {
			throw new Error(`Error: ${response.statusText}`);
		}
	} catch (error) {
		console.error('Failed to send Mattermost webhook:', error);
	}
};

const MATTERMOST_USER_IDS: Record<string, string> = {
	강명환: '@myunghwan0421',
	강명묵: '@b2000kang',
	강정훈: '@leokang123',
	김민철: '@alscjf126',
	김태엽: '@tyup303',
	김태원: '@ktw495',
	김한나: '@govmfkdtm',
	박경진: '@p_star16',
	박재윤: '@dbslzhs77',
	박현도: '@atto08',
	윤동현: '@daven1210',
	이가은: '@helenalee02',
	이동원: '@atropic159',
	이찬원: '@clw8679',
	이채원: '@sandy2011',
	이상은: '@sangrlo',
	송강규: '@sgk1004s',
	장세정: '@jjssj343',
	장익환: '@bluensky0213',
	장지현: '@wlguswlgus989',
	전승현: '@dokv1004',
	정승현: '@sj06937',
	정인호: '@stampho',
	정제영: '@aia1235',
	조동휘: '@whehdgnl1998',
	차민수: '@minns00',
	차은수: '@eunsu321',
};
