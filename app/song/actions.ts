'use server';

import { createClient } from '@/utils/supabase/server';

export async function searchSongAtYouTube(query: string) {
	const apiKey = process.env.GOOGLE_YOUTUBE_API_KEY;

	if (!apiKey) {
		throw new Error('YOUTUBE_API_KEY가 설정되지 않았습니다.');
	}

	const searchQuery = `${query} 금영 노래방 KY Karaoke`;
	const response = await fetch(
		`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
			searchQuery,
		)}&type=video&videoEmbeddable=true&key=${apiKey}&maxResults=30`,
	);

	const data = await response.json();

	const items = data.items || [];

	// 2. TJ 키워드가 포함된 영상 배제 (대소문자 구분 없이 검사)
	const filteredItems = items.filter((item: any) => {
		const title = item.snippet?.title?.toUpperCase() || '';
		const channelTitle = item.snippet?.channelTitle?.toUpperCase() || '';

		// 제목이나 채널명에 TJ가 포함되어 있으면 false 리턴하여 제외
		const hasTJ = title.includes('TJ') || channelTitle.includes('TJ');
		return !hasTJ;
	});

	// 3. 정제해서 반환
	return filteredItems.map((item: any) => ({
		id: item.id.videoId,
		title: item.snippet.title,
		youtubeUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
		thumbnailUrl:
			item.snippet.thumbnails.medium?.url ||
			item.snippet.thumbnails.default?.url,
	}));
}
/** 1. 반 id 기반 전체 노래 기록/대기열 불러오기 */
export async function getSongRecords() {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from('song_records')
		.select('*')
		.order('display_order', { ascending: true }); // order 오름차순 정렬

	if (error) {
		throw new Error(`노래 기록 조회 실패: ${error.message}`);
	}
	return data ?? [];
}

/** 2. 큐의 가장 앞(1순위) 노래 조회 */
export async function getTopSongRecord() {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from('song_records')
		.select('*')
		.eq('status', 'pending')
		.order('display_order', { ascending: true })
		.limit(1)
		.maybeSingle();

	if (error) {
		throw new Error(`맨 앞 노래 조회 실패: ${error.message}`);
	}
	return data;
}

/** 3. 노래 큐 추가 (Deque: Front 추가 / Back 추가) */
export async function addSongRecord(
	name: string,
	reason: string,
	isFront: boolean = false, // true면 맨 앞(우선 예약), false면 맨 뒤(일반 예약)
) {
	const supabase = await createClient();

	// 현재 대기 중인 항목들의 min/max display_order 조회
	const { data: borderRecords } = await supabase
		.from('song_records')
		.select('display_order')
		.eq('status', 'pending')
		.order('display_order', { ascending: true });

	let newOrder = 1000; // 기본값 (초기 데이터용)

	if (borderRecords && borderRecords.length > 0) {
		if (isFront) {
			// Deque push_front: 현재 최소값보다 작게 설정
			newOrder = borderRecords[0].display_order - 1;
		} else {
			// Deque push_back: 현재 최대값보다 크게 설정
			newOrder = borderRecords[borderRecords.length - 1].display_order + 1;
		}
	}

	const { data, error } = await supabase.from('song_records').insert([
		{
			user_name: name,
			reason,
			display_order: newOrder,
			status: 'pending',
		},
	]);

	if (error) {
		throw new Error(`노래 큐 추가 실패: ${error.message}`);
	}

	return { data, error };
}

/** 4. 가장 앞의 노래 시작 (유튜브 정보 등록 & Live 전환) */
export async function startTopSongRecord({
	id,
	songName,
	youtubeUrl,
}: {
	id: string;
	songName: string;
	youtubeUrl: string;
	youtubeVideoId: string;
}) {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from('song_records')
		.update({
			song_name: songName,
			youtube_url: youtubeUrl,
			status: 'singing',
		})
		.eq('id', id);

	if (error) {
		throw new Error(`노래 시작 처리 실패: ${error.message}`);
	}
	return { data, error };
}

/** 5. 가장 앞의 노래 종료/완료 처리 (Pop Front) */
export async function completeSongRecord(id: string) {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from('song_records')
		.update({
			status: 'completed',
		})
		.eq('id', id);

	if (error) {
		throw new Error(`노래 완료 처리 실패: ${error.message}`);
	}

	return { data, error };
}

/** 6. 기록 삭제 대신 cancel 처리 */
export async function cancelSongRecord(id: string) {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from('song_records')
		.update({
			status: 'canceled',
		})
		.eq('id', id);

	if (error) {
		throw new Error(`노래 취소 처리 실패: ${error.message}`);
	}

	return { data, error };
}

// 채팅 메세지 불러오기
export async function getChatMessages(songId: string) {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from('song_chats')
		.select('*')
		.eq('song_id', songId)
		.order('created_at', { ascending: true });

	if (error) {
		console.error('채팅 목록 조회 실패:', error.message);
		return [];
	}
	return data;
}

/** 2. 채팅 메시지 전송 */
export async function sendChatMessage({
	songId,
	senderName,
	nickname,
	message,
}: {
	songId: string;
	senderName: string;
	nickname: string;
	message: string;
}) {
	const supabase = await createClient();
	const { error } = await supabase.from('song_chats').insert([
		{
			song_record_id: songId,
			user_name: senderName,
			nickname: nickname,
			message,
		},
	]);

	if (error) {
		throw new Error(`메시지 전송 실패: ${error.message}`);
	}
}
/** 드래그 앤 드롭 후 전체 대기열 순서 일괄 재정렬 */
export async function reorderSongRecords(
	orderedSingers: { id: string; display_order: number }[],
) {
	const supabase = await createClient();

	// 각 레코드의 display_order 값을 일괄 업데이트
	const updates = orderedSingers.map((singer) =>
		supabase
			.from('song_records')
			.update({ display_order: singer.display_order })
			.eq('id', singer.id),
	);

	await Promise.all(updates);

	return { success: true };
}
