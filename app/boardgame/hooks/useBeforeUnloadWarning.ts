import { useEffect } from 'react';

/**
 * 편집 모드에서 타일 잠금을 쥐고 있는 동안 페이지를 떠나려 하면 브라우저 이탈 경고를 띄운다.
 */
export function useBeforeUnloadWarning(
	isEditMode: boolean,
	selectedTileId: string | null,
) {
	useEffect(() => {
		// 잠금을 쥐고 있는 상태인지 확인
		const hasLock = isEditMode && !!selectedTileId;

		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (!hasLock) return;

			// 표준 브라우저 이탈 방지 트리거
			e.preventDefault();
			e.returnValue = ''; // Chrome 등에서 필수 설정
		};

		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	}, [isEditMode, selectedTileId]);
}
