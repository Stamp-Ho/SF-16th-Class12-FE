'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// =================================================================
// Types
// =================================================================

export interface CreateRoundRequest {
	round: number;
	title: string;
	peoplePerGroup: number;
	isGambleEnabled?: boolean;
	seatCodes?: string[];
	initialGroups?: {
		groupName: string;
		member_1?: string;
		member_2?: string;
		member_3?: string;
	}[];
}

export interface GroupRequest {
	groupName: string;
	member_1?: string;
	member_2?: string;
	member_3?: string;
}

export interface BidRequest {
	allocationId: number;
	nextGroupId: number;
	userName: string;
	prevUsers?: string[];
	seatCode: string;
}

export interface GambleRequest {
	allocationId: number;
	userName: string;
	priceChange: number;
}

export interface DetailAssignRequest {
	allocationId: number;
	memberLeft: string | null;
	memberMiddle: string | null;
	memberRight: string | null;
}

// =================================================================
// 1. 라운드 관리 (Round Management)
// =================================================================

/**
 * 모든 라운드 조회 (round 오름차순)
 */
export async function getAllRounds() {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from('seat_rounds')
		.select('*')
		.order('round', { ascending: false });

	if (error) throw new Error(`라운드 목록 조회 실패: ${error.message}`);
	return data;
}

/**
 * 라운드 생성 및 기본 좌석(기본 A~M) 일괄 생성
 */
export async function createRound(request: CreateRoundRequest) {
	const supabase = await createClient();

	// 1. 라운드 생성
	const { data: roundData, error: roundError } = await supabase
		.from('seat_rounds')
		.insert({
			round: request.round,
			title: request.title,
			people_per_group: request.peoplePerGroup,
			is_gamble_enabled: request.isGambleEnabled ?? true,
		})
		.select()
		.single();

	if (roundError) throw new Error(`라운드 생성 실패: ${roundError.message}`);

	// 2. 기본 좌석 목록 구성 (입력값이 없으면 A~M)
	const defaultCodes = [
		'A',
		'B',
		'C',
		'D',
		'E',
		'F',
		'G',
		'H',
		'I',
		'J',
		'K',
		'L',
		'M',
		'가',
		'나',
		'다',
	];
	const seatCodes =
		request.seatCodes && request.seatCodes.length > 0
			? request.seatCodes
			: defaultCodes;

	const allocationsToInsert = seatCodes.map((code) => ({
		round_id: roundData.id,
		seat_code: code,
		bid_price: 0,
		is_locked: false,
	}));

	const seatGroupsToInsert =
		request.initialGroups?.map((group) => ({
			round_id: roundData.id,
			group_name: group.groupName,
			member_1: group.member_1 ?? null,
			member_2: group.member_2 ?? null,
			member_3: group.member_3 ?? null,
		})) ?? [];

	const { error: allocationError } = await supabase
		.from('seat_allocations')
		.insert(allocationsToInsert);

	if (allocationError)
		throw new Error(`좌석 생성 실패: ${allocationError.message}`);

	if (seatGroupsToInsert.length > 0) {
		const { error: seatGroupError } = await supabase
			.from('seat_groups')
			.insert(seatGroupsToInsert);
		if (seatGroupError)
			throw new Error(`그룹 생성 실패: ${seatGroupError.message}`);
	}

	revalidatePath('/seats');
	return roundData;
}

/**
 * 라운드 마감
 */
export async function closeRound(round: number) {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from('seat_rounds')
		.update({ is_closed: true })
		.eq('id', round)
		.select()
		.single();

	if (error) throw new Error(`라운드 마감 실패: ${error.message}`);
	revalidatePath('/seats');
	return data;
}

/**
 * 라운드 재오픈
 */
export async function openRound(round: number) {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from('seat_rounds')
		.update({ is_closed: false })
		.eq('id', round)
		.select()
		.single();

	if (error) throw new Error(`라운드 오픈 실패: ${error.message}`);
	revalidatePath('/seats');
	return data;
}

/**
 * 라운드 도박 허용/금지 토글
 */
export async function toggleGamble(round: number) {
	const supabase = await createClient();

	// 1. 현재 도박 허용 상태 조회
	const { data: current, error: fetchError } = await supabase
		.from('seat_rounds')
		.select('is_gamble_enabled')
		.eq('id', round)
		.single();

	if (fetchError || !current) {
		throw new Error('존재하지 않는 라운드입니다.');
	}

	// 2. 상태 반전 업데이트
	const { data, error: updateError } = await supabase
		.from('seat_rounds')
		.update({
			is_gamble_enabled: !current.is_gamble_enabled,
		})
		.eq('id', round)
		.select()
		.single();

	if (updateError)
		throw new Error(`도박 상태 변경 실패: ${updateError.message}`);
	revalidatePath('/seats');
	return data;
}

/**
 * 라운드 삭제 (CASCADE에 의해 관련 그룹, 좌석, 히스토리 자동 삭제)
 */
export async function deleteRound(round: number) {
	const supabase = await createClient();

	const { error } = await supabase.from('seat_rounds').delete().eq('id', round);

	if (error) throw new Error(`라운드 삭제 실패: ${error.message}`);
	revalidatePath('/seats');
	return { success: true };
}

// =================================================================
// 2. 그룹 편성 (Group Management)
// =================================================================

/**
 * 특정 라운드의 그룹 목록 조회
 */
export async function getGroupsByRound(round: number) {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from('seat_groups')
		.select('*')
		.eq('round', round)
		.order('id', { ascending: true });

	if (error) throw new Error(`그룹 목록 조회 실패: ${error.message}`);
	return data;
}

/**
 * 신규 그룹 등록
 */
export async function createGroup(round: number, request: GroupRequest) {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from('seat_groups')
		.insert({
			round: round,
			group_name: request.groupName,
			member_1: request.member_1 ?? null,
			member_2: request.member_2 ?? null,
			member_3: request.member_3 ?? null,
		})
		.select()
		.single();

	if (error) throw new Error(`그룹 생성 실패: ${error.message}`);
	revalidatePath('/seats');
	return data;
}

/**
 * 좌석 배정 초기화 (deleteAllocation)
 */
export async function deleteAllocation(allocationId: number) {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from('seat_allocations')
		.update({
			group_id: null,
			member_left: null,
			member_middle: null,
			member_right: null,
			bid_price: 0,
		})
		.eq('id', allocationId)
		.select()
		.single();

	if (error) throw new Error(`좌석 배정 초기화 실패: ${error.message}`);
	revalidatePath('/seats');
	return data;
}

// =================================================================
// 3. 좌석 배정 및 입찰 / Gamble (Seat Allocation & Bidding)
// =================================================================

/**
 * 특정 라운드의 좌석 배정 현황 조회 (seat_code 오름차순)
 */
export async function getAllocationsByRound(round_id: number) {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from('seat_allocations')
		.select(
			`
      *,
      seat_group:group_id (
        group_name
      )
    `,
		)
		.eq('round_id', round_id)
		.order('seat_code', { ascending: true });

	if (error) throw new Error(`좌석 배정 현황 조회 실패: ${error.message}`);
	return data;
}

export async function getSeatsDataByRounds(roundIds: number[]) {
	if (!roundIds.length) return { groups: [], allocations: [] };

	const supabase = await createClient();

	// 단 2번의 DB 쿼리를 병렬 실행
	const [groupsRes, allocationsRes] = await Promise.all([
		supabase
			.from('seat_groups')
			.select('*')
			.in('round_id', roundIds)
			.order('id', { ascending: true }),

		supabase
			.from('seat_allocations')
			.select(
				`
        *,
        seat_group:group_id (
          group_name
        )
      `,
			)
			.in('round_id', roundIds)
			.order('seat_code', { ascending: true }),
	]);

	if (groupsRes.error)
		throw new Error(`그룹 목록 조회 실패: ${groupsRes.error.message}`);
	if (allocationsRes.error)
		throw new Error(
			`좌석 배정 현황 조회 실패: ${allocationsRes.error.message}`,
		);

	return {
		groups: groupsRes.data,
		allocations: allocationsRes.data,
	};
}
/**
 * 일반 입찰 (RPC 호출)
 */
export async function placeBid(request: BidRequest) {
	const supabase = await createClient();
	console.log(request.nextGroupId);

	const { data, error } = await supabase.rpc('place_bid_with_shield', {
		p_allocation_id: request.allocationId,
		p_next_group_id: request.nextGroupId,
		p_user_name: request.userName,
	});

	if (error) throw new Error(`입찰 실패: ${error.message}`);
	else {
		try {
			if (
				request.prevUsers &&
				request.prevUsers.length > 0 &&
				request.seatCode
			) {
				sendMattermostNoticeOnSeatBid({
					seatCode: request.seatCode,
					attacker: request.userName,
					victims: request.prevUsers,
				});
			}
		} catch (err: any) {
			console.error(`Failed to send Mattermost notice: ${err.message}`);
		}
	}
	revalidatePath('/seats');
	return data;
}

/**
 * 행운 뽑기 입찰 (RPC 호출)
 */
export async function gambleBid(request: GambleRequest) {
	const supabase = await createClient();

	const { data, error } = await supabase.rpc('gamble_bid', {
		p_allocation_id: request.allocationId,
		p_user_name: request.userName,
		p_price_change: request.priceChange,
	});

	if (error) throw new Error(`행운뽑기 실패: ${error.message}`);
	revalidatePath('/seats');
	return data;
}

/**
 * 최종 낙찰 후 세부 자리(좌/중/우) 지정
 */
export async function assignDetailedSeat(request: DetailAssignRequest) {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from('seat_allocations')
		.update({
			member_left: request.memberLeft ?? null,
			member_middle: request.memberMiddle ?? null,
			member_right: request.memberRight ?? null,
		})
		.eq('id', request.allocationId)
		.select()
		.single();

	if (error) throw new Error(`세부 자리 지정 실패: ${error.message}`);
	revalidatePath('/seats');
	return data;
}

/**
 * 좌석 잠금 및 잠금 해제 토글
 */
export async function toggleLockSeat(allocationId: number) {
	const supabase = await createClient();

	// 1. 현재 락 상태 조회
	const { data: current, error: fetchError } = await supabase
		.from('seat_allocations')
		.select('is_locked')
		.eq('id', allocationId)
		.single();

	if (fetchError || !current) {
		throw new Error('존재하지 않는 좌석입니다.');
	}

	// 2. 상태 반전 업데이트
	const { data, error: updateError } = await supabase
		.from('seat_allocations')
		.update({
			is_locked: !current.is_locked,
		})
		.eq('id', allocationId)
		.select()
		.single();

	if (updateError)
		throw new Error(`좌석 잠금 변경 실패: ${updateError.message}`);
	revalidatePath('/seats');
	return data;
}

// =================================================================
// 4. 히스토리 조회 (History)
// =================================================================

/**
 * 특정 라운드의 입찰 기록 조회 (created_at 내림차순)
 */
export async function getHistoriesByRound(round_id: number) {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from('seat_bid_histories')
		.select('*')
		.eq('round_id', round_id)
		.order('created_at', { ascending: false });

	if (error) throw new Error(`히스토리 조회 실패: ${error.message}`);
	return data;
}

/**
 * 좌석 입찰시 메터모스트 알림 전송
 */
export const sendMattermostNoticeOnSeatBid = async ({
	victims,
	seatCode,
	attacker,
}: {
	victims: string[];
	seatCode: string;
	attacker: string;
}) => {
	const webhookUrl = process.env.MATTERMOST_CLASS_WEBHOOK;
	console.log('webhookUrl:', webhookUrl);
	if (!webhookUrl) {
		throw new Error('매터모스트 클래스 웹훅이 정의되지 않았습니다.');
	}
	const message = `### 🚨 좌석 입찰 알림 🚨
코드: ${seatCode} | ${attacker} ⚔️ [ ${victims.map((v) => MATTERMOST_USER_IDS[v]).join(', ')} ]`;
	try {
		const response = await fetch(webhookUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
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
