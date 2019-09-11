import { Entity, Rect, Point, Size, Camera } from './interfaces';
import { CAMERA_WIDTH_MAX, CAMERA_WIDTH_MIN, CAMERA_HEIGHT_MAX, CAMERA_HEIGHT_MIN } from './constants';
import { clamp, intersect, pointInXYWH, pointInRect, lerp } from './utils';
import { toScreenX, toScreenY, toWorldX, toWorldY } from './positionUtils';
import { getChatBallonXY } from '../graphics/graphicsUtils';

const cameraPadding = 0.3;
export const characterHeight = 25;
export const characterWidth = 24;

export function createCamera(): Camera {
	return {
		x: 0,
		y: 0,
		w: 100,
		h: 100,
		offset: 0,
		shift: 0,
		shiftTarget: 0,
		shiftRatio: 0,
		actualY: 0,
	};
}

export function setupCamera(camera: Camera, x: number, y: number, width: number, height: number, map: Size) {
	camera.w = clamp(width, CAMERA_WIDTH_MIN, CAMERA_WIDTH_MAX);
	camera.h = clamp(height, CAMERA_HEIGHT_MIN, CAMERA_HEIGHT_MAX);
	camera.x = clamp(x, 0, toScreenX(map.width) - camera.w);
	camera.y = clamp(y, 0, toScreenY(map.height) - camera.h);
}

export function updateCamera(
	camera: Camera,
	player: Point,
	map: Size,
	panning?: Point,
) {
	// camera.x and camera.y are the coordinate of the *top left corner*
	// of the camera

	// ptxel:
	// The concept of a pixel in pixel.horse graphics
	// -- same as a screen pixel when the zoom is 1

	const cameraWidth = camera.w;
	const cameraHeight = camera.h;
	const cameraHeightShifted = Math.ceil(camera.h - camera.offset);

	// (A)
	// player.x / y and map.width / height are counted in tiles rather
	// than ptxels, so this is a conversion step from tilecount to ptxel
	// location
	const playerX = toScreenX(player.x);
	const playerY = toScreenY(player.y);

	const mapWidth = toScreenX(map.width);
	const mapHeight = toScreenY(map.height);

	// (B)
	// The below block is about dealing with small maps. In small maps,
	// we want the visible part to be centered (useful cases)
	// In **basic** cases, minX / minY will be 0
	// and maxX / maxY will be `mapSize - cameraSize`
	// (It just prevents the camera from pocking out in the bottom right
	// corner of the map)
	// In **useful** cases, we'll have minX = maxX < 0 / minY = maxY < 0
	// Technically, it centers the top left corner of the map inside all
	// the empty space that could be found to the top and the left of
	// the map, if the map was placed to the bottom right of the screen.
	const minX = Math.min(0, (mapWidth - cameraWidth) / 2);
	const minY = Math.min(0, (mapHeight - cameraHeight) / 2);
	const minYShifted = Math.min(0, (mapHeight - cameraHeightShifted) / 2);
	const maxX = Math.max(mapWidth - cameraWidth, minX);
	const maxY = Math.max(mapHeight - cameraHeight, minY);
	const maxYShifted = Math.max(mapHeight - cameraHeightShifted, minY);

	const padCamera = !panning;

	let minCamX: number;
	let maxCamX: number;
	let minCamY: number;
	let maxCamY: number;
	let minCamYShifted: number;
	let maxCamYShifted: number;

	if (padCamera) {
		// (C)
		// hSpace / vSpace are the room at the center of the camera where
		// the creature can move without having the camera follow them.
		const hSpace = Math.floor(cameraWidth * cameraPadding);
		const vSpace = Math.floor(cameraHeight * cameraPadding);
		const vSpaceShifted = Math.floor(cameraHeightShifted * cameraPadding);

		// (D)
		// hPad / vPad are the sizes of the bands to the sides of that
		// central room
		const hPad = (cameraWidth - hSpace) / 2;
		const vPad = (cameraHeight - vSpace) / 2;
		const vPadShifted = (cameraHeightShifted - vSpaceShifted) / 2;

		// (E1)
		// The below block actually computes the locations of these
		// bands, in terms of the X/Y coordinates of the camera.
		// If the player is near an edge of the map, minX/Y / maxX/Y
		// kick in to force pervent the camera from poking out of the
		// map.
		minCamX = clamp(playerX - (hSpace + hPad), minX, maxX);
		maxCamX = clamp(playerX - hPad, minX, maxX);
		minCamY = clamp(playerY - (vSpace + vPad) - characterHeight, minY, maxY);
		maxCamY = clamp(playerY - vPad - characterHeight, minY, maxY);
		minCamYShifted = clamp(playerY - (vSpaceShifted + vPadShifted) - characterHeight, minYShifted, maxYShifted);
		maxCamYShifted = clamp(playerY - vPadShifted - characterHeight, minYShifted, maxYShifted);
	} else {
		// (E2)
		// With no padding, we just want to make sure the player is visible.
		// minX/Y and maxX/Y play the same role as in (E1)
		minCamX = clamp(playerX + characterWidth - cameraWidth, minX, maxX);
		maxCamX = clamp(playerX - characterWidth, minX, maxX);
		minCamY = clamp(playerY + 2 * characterHeight - cameraHeight - characterHeight, minY, maxY);
		maxCamY = clamp(playerY - 3 * characterHeight, minY, maxY);
		minCamYShifted = clamp(playerY + 2 * characterHeight - cameraHeight, minYShifted, maxYShifted);
		maxCamYShifted = clamp(playerY - 3 * characterHeight, minYShifted, maxYShifted);
	}

	// (F)
	// Finally, we need to move the camera only when the creature is
	// pressing against one of the earlier defined sides
	if (panning) {
		camera.x = playerX - cameraWidth / 2 + panning.x;
		camera.y = playerY - cameraHeight / 2 + panning.y;
	}
	camera.x = Math.floor(clamp(camera.x, minCamX, maxCamX));
	camera.y = Math.floor(clamp(camera.y, minCamY, maxCamY));
	camera.shiftTarget = Math.floor(clamp(camera.shiftTarget, minCamYShifted, maxCamYShifted));
	camera.actualY = calculateCameraY(camera);

	// Note:
	// The logic for computing the camera position does not need steps
	// (B), (C) and (D) to be run each time, as it is currently the case
	// These must be recomputed only when the camera is changed.
	// Only (A), (E) and (F) depend on the creature position.
}

export function centerCameraOn(camera: Camera, point: Point) {
	camera.x = Math.floor(toScreenX(point.x) - camera.w / 2);
	camera.y = Math.floor((toScreenY(point.y) - camera.h / 2) - characterHeight);
	camera.shiftTarget = Math.floor((toScreenY(point.y) - Math.ceil(camera.h - camera.offset) / 2) - characterHeight);
}

export function calculateCameraY(camera: Camera) {
	return Math.round(lerp(camera.y, camera.shiftTarget - camera.offset, camera.shiftRatio));
}

export function isWorldPointVisible(camera: Camera, point: Point): boolean {
	return pointInRect(toScreenX(point.x), toScreenY(point.y), camera);
}

export function isWorldPointWithPaddingVisible(camera: Camera, point: Point, padding: number): boolean {
	return pointInXYWH(
		toScreenX(point.x), toScreenY(point.y),
		camera.x - padding, camera.actualY - padding, camera.w + 2 * padding, camera.h + 2 * padding);
}

export function isAreaVisible(camera: Camera, x: number, y: number, w: number, h: number): boolean {
	return intersect(camera.x, camera.actualY, camera.w, camera.h, x, y, w, h);
}

export function isRectVisible(camera: Camera, rect: Rect): boolean {
	return intersect(camera.x, camera.actualY, camera.w, camera.h, rect.x, rect.y, rect.w, rect.h);
}

export function isBoundsVisible(camera: Camera, bounds: Rect | undefined, x: number, y: number): boolean {
	return bounds !== undefined &&
		isAreaVisible(camera, toScreenX(x) + bounds.x, toScreenY(y) + bounds.y, bounds.w, bounds.h);
}

export function isEntityVisible(camera: Camera, entity: Entity): boolean {
	return isBoundsVisible(camera, entity.bounds, entity.x, entity.y);
}

function isChatBaloonAboveScreenTop(camera: Camera, entity: Entity) {
	return getChatBallonXY(entity, camera).y <= -5;
}

export function isChatVisible(camera: Camera, entity: Entity): boolean {
	return isBoundsVisible(camera, entity.bounds, entity.x, entity.y)
		&& !isChatBaloonAboveScreenTop(camera, entity);
}

export function screenToWorld(camera: Camera, point: Point): Point {
	return {
		x: toWorldX(point.x + camera.x),
		y: toWorldY(point.y + camera.actualY),
	};
}

export function worldToScreen(camera: Camera, point: Point): Point {
	return {
		x: Math.floor(toScreenX(point.x) - camera.x),
		y: Math.floor(toScreenY(point.y) - camera.actualY),
	};
}

export function screenToPanning(camera: Camera, cursor: Point): Point {
	return {
		x: (cursor.x / camera.w - 0.5) * camera.w,
		y: (cursor.y / camera.h - 0.5) * (camera.h + 2 * characterHeight),
	};
}

// export function mapDepth(camera: Camera, y: number): number {
// 	return (toScreenY(y) - camera.actualY) - camera.maxDepth;
// }
