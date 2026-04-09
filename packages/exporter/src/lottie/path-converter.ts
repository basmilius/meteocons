import { SVGPathData } from 'svg-pathdata';
import type { LottieBezier } from './types';

/**
 * Converts an SVG path `d` attribute to one or more Lottie bezier objects.
 * Each subpath (M command) becomes a separate bezier.
 */
export function svgPathToLottieBeziers(d: string): LottieBezier[] {
    const commands = new SVGPathData(d)
        .toAbs()
        .normalizeST()
        .qtToC()
        .aToC()
        .commands;

    const beziers: LottieBezier[] = [];
    let current: LottieBezier | null = null;
    let prevX = 0;
    let prevY = 0;

    for (const cmd of commands) {
        switch (cmd.type) {
            case SVGPathData.MOVE_TO: {
                if (current) {
                    beziers.push(current);
                }
                current = {v: [[cmd.x, cmd.y]], i: [[0, 0]], o: [[0, 0]], c: false};
                prevX = cmd.x;
                prevY = cmd.y;
                break;
            }

            case SVGPathData.LINE_TO: {
                if (!current) {
                    break;
                }
                current.v.push([cmd.x, cmd.y]);
                current.i.push([0, 0]);
                current.o.push([0, 0]);
                prevX = cmd.x;
                prevY = cmd.y;
                break;
            }

            case SVGPathData.HORIZ_LINE_TO: {
                if (!current) {
                    break;
                }
                current.v.push([cmd.x, prevY]);
                current.i.push([0, 0]);
                current.o.push([0, 0]);
                prevX = cmd.x;
                break;
            }

            case SVGPathData.VERT_LINE_TO: {
                if (!current) {
                    break;
                }
                current.v.push([prevX, cmd.y]);
                current.i.push([0, 0]);
                current.o.push([0, 0]);
                prevY = cmd.y;
                break;
            }

            case SVGPathData.CURVE_TO: {
                if (!current) {
                    break;
                }
                // Out-tangent of previous vertex (control point 1, relative to prevX/Y)
                current.o[current.o.length - 1] = [cmd.x1 - prevX, cmd.y1 - prevY];
                // New vertex: in-tangent is control point 2, relative to new vertex
                current.v.push([cmd.x, cmd.y]);
                current.i.push([cmd.x2 - cmd.x, cmd.y2 - cmd.y]);
                current.o.push([0, 0]);
                prevX = cmd.x;
                prevY = cmd.y;
                break;
            }

            case SVGPathData.CLOSE_PATH: {
                if (current) {
                    current.c = true;
                }
                break;
            }
        }
    }

    if (current) {
        beziers.push(current);
    }

    return beziers;
}
