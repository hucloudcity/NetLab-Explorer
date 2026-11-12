import React, { useLayoutEffect, useRef } from 'react';
import { createPointMotion, pointOnRoute } from './point-motion.mjs';

const TRAIL_OFFSETS = [0.08, 0.16];

export function TravelDot({ points, duration, mode, motionKey }) {
  const motion = useRef(null);
  const main = useRef(null), trails = [useRef(null), useRef(null)];
  const element = main;
  const routeKey = JSON.stringify(points);
  useLayoutEffect(() => {
    const circle = element.current;
    const controller = createPointMotion({
      points, duration,
      requestFrame: callback => requestAnimationFrame(callback),
      cancelFrame: id => cancelAnimationFrame(id),
      paint([x, y], progress) {
        circle.setAttribute('cx', String(x));
        circle.setAttribute('cy', String(y));
        circle.setAttribute('data-progress', progress.toFixed(4));
        // 拖尾：主包后方的两个渐隐残影，共用同一时间轴，暂停时同步驻留。
        trails.forEach((ref, i) => {
          const ghost = ref.current;
          if (!ghost) return;
          const p = Math.max(0, progress - TRAIL_OFFSETS[i]);
          const [gx, gy] = pointOnRoute(points, p);
          ghost.setAttribute('cx', String(gx));
          ghost.setAttribute('cy', String(gy));
          ghost.setAttribute('opacity', p > 0.001 ? String(0.38 - i * 0.18) : '0');
        });
      },
    });
    motion.current = controller;
    return () => controller.pause();
  }, [motionKey, routeKey]);
  useLayoutEffect(() => {
    const controller = motion.current;
    controller.setDuration(duration);
    if (mode === 'paused') controller.pause();
    else controller.play();
    return () => controller.pause();
  }, [motionKey, routeKey, duration, mode]);
  return <g aria-hidden="true">
    {trails.map((ref, i) => <circle key={i} ref={ref} className="iso-trail-dot" data-trail={i + 1}
      r={5 - i * 1.3} cx={points[0][0]} cy={points[0][1]} opacity="0" />)}
    <circle ref={element} className="flow-particle iso-travel-dot" r="7"
      cx={points[0][0]} cy={points[0][1]} data-motion={mode} aria-hidden="true" />
  </g>;
}
