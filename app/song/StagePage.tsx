'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import YouTube, { YouTubeProps, YouTubePlayer } from 'react-youtube';
import {
	completeSongRecord,
	getChatMessages,
	sendChatMessage,
} from './actions';
import {
	MicVocal,
	Play,
	Pause,
	RotateCcw,
	RotateCw,
	SkipForward,
	Send,
	MessageSquare,
	Volume2,
	VolumeX,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function StagePage({
	stageData,
	user,
}: {
	stageData: any;
	user: { name: string; role: string };
}) {
	const supabase = useMemo(() => createClient(), []);
	const chatListRef = useRef<HTMLDivElement | null>(null);
	const shouldStickToBottomRef = useRef(true);
	const pendingAutoScrollRef = useRef(false);

	const [player, setPlayer] = useState<YouTubePlayer | null>(null);
	const [isPlaying, setIsPlaying] = useState(true);
	const [isMuted, setIsMuted] = useState(false);

	const [showFullScreen, setShowFullScreen] = useState(true);
	// 채팅 상태
	const [messages, setMessages] = useState<
		{ id: string; sender: string; text: string; time: string }[]
	>([
		{
			id: '1',
			sender: 'SSAFY 12반 Bot',
			text: '🎤 무대가 시작되었습니다! 응원의 메시지를 남겨주세요!',
			time: '방금 전',
		},
	]);
	const [chatInput, setChatInput] = useState('');
	const [nickName, setNickName] = useState(user.name);

	const isAdmin = user.role.includes('song') || user.role.includes('teacher');

	const onPlayerReady: YouTubeProps['onReady'] = (event) => {
		setPlayer(event.target);
	};

	const togglePlay = () => {
		if (!player) return;
		if (isPlaying) {
			player.pauseVideo();
			setIsPlaying(false);
		} else {
			player.playVideo();
			setIsPlaying(true);
		}
	};

	const toggleMute = () => {
		if (!player) return;
		if (isMuted) {
			player.unMute();
			setIsMuted(false);
		} else {
			player.mute();
			setIsMuted(true);
		}
	};

	const seekTo = (seconds: number) => {
		if (!player) return;
		const currentTime = player.getCurrentTime();
		player.seekTo(currentTime + seconds, true);
	};

	const handleFinishSong = async () => {
		try {
			await completeSongRecord(stageData.id);
		} catch (err) {
			console.error('노래 종료 실패:', err);
		}
	};

	const handleSendMessage = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!chatInput.trim()) return;

		await sendChatMessage({
			songId: stageData.id,
			senderName: user.name,
			nickname: nickName.trim() || user.name,
			message: chatInput,
		});

		setChatInput('');
	};

	const scrollChatToBottom = () => {
		const el = chatListRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	};

	const updateShouldStickToBottom = () => {
		const el = chatListRef.current;
		if (!el) return;

		// 마지막 채팅 2개 정도 높이 범위 내에 있으면 하단 고정으로 간주
		const nearBottomThreshold = 180;
		const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
		shouldStickToBottomRef.current = distanceFromBottom <= nearBottomThreshold;
	};

	useEffect(() => {
		if (!stageData.id) return;

		// 기존 채팅 불러오기
		getChatMessages(stageData.id).then((initialData) => {
			setMessages(
				initialData.map((msg: any) => ({
					id: msg.id,
					sender: msg.nickname || msg.user_name || '익명',
					text: msg.message,
					time: new Date(msg.created_at).toLocaleTimeString('ko-KR', {
						hour: '2-digit',
						minute: '2-digit',
					}),
				})),
			);

			requestAnimationFrame(() => {
				scrollChatToBottom();
				shouldStickToBottomRef.current = true;
			});
		});

		// 해당 song_id 세션에 대한 INSERT 이벤트만 Realtime 구독
		const channel = supabase
			.channel(`song_chats`)
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'song_chats',
					filter: `song_record_id=eq.${stageData.id}`, // 해당 노래 세션 채팅만 수신
				},
				(payload) => {
					const newChat = payload.new;
					const shouldAutoScroll = shouldStickToBottomRef.current;

					if (shouldAutoScroll) {
						pendingAutoScrollRef.current = true;
					}

					setMessages((prev) => [
						...prev,
						{
							id: newChat.id,
							sender: newChat.nickname || newChat.user_name || '익명',
							text: newChat.message,
							time: new Date(newChat.created_at).toLocaleTimeString('ko-KR', {
								hour: '2-digit',
								minute: '2-digit',
							}),
						},
					]);
				},
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [stageData.id, supabase]);

	useEffect(() => {
		if (!pendingAutoScrollRef.current) return;

		requestAnimationFrame(() => {
			scrollChatToBottom();
			pendingAutoScrollRef.current = false;
			shouldStickToBottomRef.current = true;
		});
	}, [messages]);

	// 컴포넌트 내부 상단에 추가
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);

	// 재생 시간 타이머 관리
	useEffect(() => {
		if (!player || !isPlaying) return;

		const interval = setInterval(async () => {
			const current = await player.getCurrentTime();
			const dur = await player.getDuration();
			setCurrentTime(current || 0);
			setDuration(dur || 0);
		}, 500);

		return () => clearInterval(interval);
	}, [player, isPlaying]);

	// 초단위 시간을 "mm:ss" 포맷으로 변환하는 헬퍼 함수
	const formatTime = (seconds: number) => {
		if (isNaN(seconds) || seconds === 0) return '00:00';
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	};

	// 슬라이더 조작 시 재생 위치 이동
	const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newTime = parseFloat(e.target.value);
		setCurrentTime(newTime);
		if (player) {
			player.seekTo(newTime, true);
		}
	};

	const videoId =
		stageData.youtube_url?.split('v=')[1]?.split('&')[0] ||
		stageData.youtube_video_id;

	return (
		<main className="min-h-screen min-w-screen bg-background text-foregroundflex items-center justify-center font-sans overflow-hidden transition-colors duration-200">
			<div
				className={`w-full h-[calc(100vh)] flex flex-row items-center justify-center gap-2`}
			>
				{/* 👈 왼쪽 섹션: 비디오, 헤더, 커스텀 컨트롤러 */}
				<section
					className={`relative flex-1 flex flex-col h-full bg-surface min-w-0 ${showFullScreen ? 'min-w-0' : 'max-w-6xl'}`}
				>
					{/* 1. 상단 무대 헤더 */}
					<header className="absolute top-2 left-1/2 -translate-x-1/2 z-10 w-4xl bg-white/90 rounded-xl flex items-center justify-between p-5 mb-4">
						<div className="flex items-center gap-3 min-w-0">
							<div className="p-3 bg-ssafy-blue/20 rounded-2xl text-ssafy-blue animate-pulse flex-shrink-0">
								<MicVocal className="w-6 h-6" />
							</div>
							<div className="min-w-0">
								<div className="flex items-center gap-2">
									<span className="px-2 py-0.5 bg-ssafy-blue text-white text-[10px] font-black rounded-md uppercase tracking-wider flex-shrink-0">
										NOW SINGING
									</span>
									<h1 className="text-lg font-bold text-foreground truncate">
										{stageData.name}님의 무대
									</h1>
								</div>
								<p className="text-xs text-foreground/60 mt-0.5 truncate">
									🎵 {stageData.song_name || '유튜브 노래방 반주'}
								</p>
							</div>
						</div>
						<button
							onClick={() => setShowFullScreen((prev) => !prev)}
							className="flex ml-auto items-center gap-2 px-4 py-2 bg-ssafy-blue hover:bg-ssafy-blue-dark text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 flex-shrink-0"
						>
							{showFullScreen ? '작게 보기' : '크게 보기'}
						</button>

						{isAdmin && (
							<button
								onClick={handleFinishSong}
								className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 flex-shrink-0 ml-2"
							>
								<SkipForward className="w-4 h-4" />
								노래 종료
							</button>
						)}
					</header>

					{/* 2. 유튜브 플레이어 */}
					<div className="relative flex-1 w-full bg-black rounded-2xl overflow-hidden shadow-inner pointer-events-none select-none">
						<YouTube
							videoId={videoId}
							opts={{
								width: '100%',
								height: '100%',
								playerVars: {
									autoplay: 1,
									controls: 0,
									rel: 0,
									cc_load_policy: 0,
									cc_lang_pref: 'off',
									fs: 0,
									iv_load_policy: 3,
									modestbranding: 1,
									origin:
										typeof window !== 'undefined' ? window.location.origin : '',
								},
							}}
							onReady={onPlayerReady}
							onEnd={user.role === "teacher" || user.role === "song_admin" ? handleFinishSong : undefined}
							className="w-full h-full"
						/>
					</div>

					{/* 3. 하단 커스텀 컨트롤 패널 */}
					<footer className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 w-full max-w-5xl bg-white/80 backdrop-blur-md rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
						{/* 1. 재생 컨트롤 버튼 그룹 */}
						<div className="flex items-center gap-2 flex-shrink-0">
							<button
								onClick={() => seekTo(-5)}
								className="w-10 h-10 flex flex-col items-center pt-2 bg-white hover:opacity-80 text-foreground rounded-xl transition-all active:scale-95"
								title="5초 뒤로"
							>
								<RotateCcw className="w-4 h-4" />
								<p className="text-[11px] -mt-0.25">-5s</p>
							</button>

							<button
								onClick={togglePlay}
								className="p-3 bg-ssafy-blue hover:bg-ssafy-blue-dark text-white rounded-xl shadow-lg shadow-ssafy-blue/20 transition-all active:scale-95"
								title={isPlaying ? '일시정지' : '재생'}
							>
								{isPlaying ? (
									<Pause className="w-5 h-5" />
								) : (
									<Play className="w-5 h-5 fill-current" />
								)}
							</button>

							<button
								onClick={() => seekTo(5)}
								className="w-10 h-10 flex flex-col items-center pt-2 bg-white hover:opacity-80 text-foreground rounded-xl transition-all active:scale-95"
								title="5초 앞으로"
							>
								<RotateCw className="w-4 h-4" />
								<p className="text-[11px] -mt-0.25">+5s</p>
							</button>
						</div>

						{/* 2. 🎵 영상 길이 & 현재 시간 타임 슬라이더 (추가됨) */}
						<div className="flex-1 w-full flex items-center gap-3 px-2">
							<span className="text-xs font-mono font-medium text-black min-w-[40px] text-right">
								{formatTime(currentTime)}
							</span>

							<input
								type="range"
								min={0}
								max={duration || 100}
								value={currentTime}
								onChange={handleSliderChange}
								className="flex-1 h-1.5 bg-[#bbbbbb] rounded-lg appearance-none cursor-pointer accent-ssafy-blue focus:outline-none"
							/>

							<span className="text-xs font-mono font-medium text-foreground/60 min-w-[40px]">
								{formatTime(duration)}
							</span>
						</div>

						{/* 3. 음소거 및 스킵 버튼 그룹 */}
						<div className="flex items-center gap-2 flex-shrink-0">
							<button
								onClick={toggleMute}
								className="p-2.5 hover:opacity-80 text-foreground rounded-xl transition-all active:scale-95"
								title={isMuted ? '음소거 해제' : '음소거'}
							>
								{isMuted ? (
									<VolumeX className="w-5 h-5 text-rose-400" />
								) : (
									<Volume2 className="w-5 h-5" />
								)}
							</button>
						</div>
					</footer>
				</section>

				{/* 👉 오른쪽 섹션: 실시간 응원 채팅창 */}
				<section className="w-full lg:w-[380px] flex flex-col h-full bg-surface rounded-3xl border-2 border-ssafy-blue shadow-2xl p-5 overflow-hidden flex-shrink-0">
					<div className="flex items-center gap-2 pb-3 border-b-2 border-ssafy-blue mb-3">
						<MessageSquare className="w-5 h-5 text-ssafy-blue" />
						<h2 className="text-base font-bold text-foreground">
							실시간 응원 채팅
						</h2>
					</div>

					<div
						ref={chatListRef}
						onScroll={updateShouldStickToBottom}
						className="flex-1 overflow-y-auto space-y-3 pr-1 text-sm"
					>
						{messages.map((msg) => (
							<div
								key={msg.id}
								className="bg-surface-card p-3 pb-2 rounded-2xl border-2 border-ssafy-blue"
							>
								<div className="flex items-center justify-between mb-1">
									<span className="font-bold text-xs text-dark-foreground/90 truncate max-w-[70%]">
										{msg.sender}
									</span>
									<span className="text-[10px] text-foreground/40">
										{msg.time}
									</span>
								</div>
								<p className="text-foreground/90 text-xs leading-relaxed break-words">
									{msg.text}
								</p>
							</div>
						))}
					</div>

					<form
						onSubmit={handleSendMessage}
						className="mt-3 pt-3 flex flex-col gap-2"
					>
						<div className="flex gap-2">
							<div className="flex gap-2 flex-1 flex-col">
								<input
									type="text"
									value={nickName}
									onChange={(e) => setNickName(e.target.value)}
									placeholder="닉네임"
									className="w-28 bg-surface-card border-2 border-ssafy-blue rounded-xl px-3 py-2 text-sm text-foreground placeholder-foreground/40 focus:outline-none focus:border-ssafy-blue transition-all"
								/>
								<input
									type="text"
									value={chatInput}
									onChange={(e) => setChatInput(e.target.value)}
									placeholder="응원의 메시지... (닉네임 변경 가능)"
									className="flex-1 bg-surface-card border-2 border-ssafy-blue rounded-xl px-3 py-2 text-sm text-foreground placeholder-foreground/60 focus:outline-none focus:border-ssafy-blue transition-all"
								/>
							</div>
							<button
								type="submit"
								className="p-2.5 mt-auto bg-ssafy-blue hover:bg-ssafy-blue-dark text-white rounded-xl transition-all active:scale-95 flex-shrink-0"
							>
								<Send className="w-5 h-5" />
							</button>
						</div>
					</form>
				</section>
			</div>
		</main>
	);
}
