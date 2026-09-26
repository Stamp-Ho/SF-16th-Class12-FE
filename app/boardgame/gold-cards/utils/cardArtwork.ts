import * as THREE from 'three';

export function drawGoldCardArtwork(
	ctx: CanvasRenderingContext2D,
	centerX: number,
	centerY: number,
	width: number,
	height: number,
) {
	ctx.save();
	ctx.translate(centerX, centerY);
	ctx.rotate(-0.1);
	ctx.fillStyle = '#fef3c7';
	ctx.strokeStyle = '#fbbf24';
	ctx.lineWidth = Math.max(4, width * 0.05);
	ctx.beginPath();
	ctx.roundRect(-width / 2, -height / 2, width, height, width * 0.08);
	ctx.fill();
	ctx.stroke();
	ctx.strokeStyle = '#d97706';
	ctx.lineWidth = Math.max(2, width * 0.02);
	ctx.beginPath();
	ctx.roundRect(
		-width * 0.42,
		-height * 0.45,
		width * 0.84,
		height * 0.9,
		width * 0.05,
	);
	ctx.stroke();
	ctx.fillStyle = '#f59e0b';
	ctx.font = `bold ${Math.round(width * 0.48)}px serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('★', 0, 0);
	ctx.restore();
}

export function createGoldCardArtworkTexture() {
	const canvas = document.createElement('canvas');
	canvas.width = 512;
	canvas.height = 512;
	const ctx = canvas.getContext('2d');
	if (ctx) {
		ctx.fillStyle = '#9a5b08';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		drawGoldCardArtwork(ctx, 256, 256, 236, 332);
	}
	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
}

export function createGoldCardDeckTexture() {
	const canvas = document.createElement('canvas');
	canvas.width = 512;
	canvas.height = 768;
	const ctx = canvas.getContext('2d');
	if (ctx) {
		const background = ctx.createLinearGradient(
			0,
			0,
			canvas.width,
			canvas.height,
		);
		background.addColorStop(0, '#fef3c7');
		background.addColorStop(0.5, '#fef3c7');
		background.addColorStop(1, '#fcd475');
		ctx.fillStyle = '#fbbf24';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = background;
		ctx.strokeStyle = '#fff1a8';
		ctx.lineWidth = 14;
		ctx.beginPath();
		ctx.roundRect(24, 24, 464, 720, 44);
		ctx.fill();
		ctx.stroke();
		ctx.strokeStyle = '#d97706';
		ctx.lineWidth = 8;
		ctx.beginPath();
		ctx.roundRect(54, 54, 404, 660, 30);
		ctx.stroke();
		ctx.fillStyle = '#f59e0b';
		ctx.font = 'bold 250px serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('★', 256, 384);
	}
	const texture = new THREE.CanvasTexture(canvas);
	// BoxGeometry의 윗면 UV는 카드가 옆으로 눕도록 매핑되므로 세로 카드 방향으로 돌린다.
	texture.center.set(0.5, 0.5);
	texture.rotation = Math.PI;
	texture.needsUpdate = true;
	return texture;
}
