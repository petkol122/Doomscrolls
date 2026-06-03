export interface Vector2 {
  readonly x: number;
  readonly y: number;
}

export const createVector2 = (x: number, y: number): Vector2 => ({ x, y });

export const addVector2 = (left: Vector2, right: Vector2): Vector2 => ({
  x: left.x + right.x,
  y: left.y + right.y,
});

export const subtractVector2 = (left: Vector2, right: Vector2): Vector2 => ({
  x: left.x - right.x,
  y: left.y - right.y,
});

export const scaleVector2 = (vector: Vector2, scalar: number): Vector2 => ({
  x: vector.x * scalar,
  y: vector.y * scalar,
});

export const vector2LengthSquared = (vector: Vector2): number => vector.x * vector.x + vector.y * vector.y;

export const vector2DistanceSquared = (left: Vector2, right: Vector2): number =>
  vector2LengthSquared(subtractVector2(left, right));

export const ZERO_VECTOR2: Vector2 = { x: 0, y: 0 };