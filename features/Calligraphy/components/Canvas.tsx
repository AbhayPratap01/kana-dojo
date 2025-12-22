'use client';
import { useRef, useEffect, useCallback, useState } from 'react';
import useCalligraphyStore from '@/features/Calligraphy/store/useCalligraphyStore';

interface Point {
  x: number;
  y: number;
  pressure: number;
}

const Canvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [completedStrokes, setCompletedStrokes] = useState<Point[][]>([]);
  const [isCurrentStrokeValid, setIsCurrentStrokeValid] = useState(true);

  const selectedBrushType = useCalligraphyStore(
    state => state.selectedBrushType
  );
  const selectedCharacter = useCalligraphyStore(
    state => state.selectedCharacter
  );
  const currentStrokeIndex = useCalligraphyStore(
    state => state.currentStrokeIndex
  );
  const showGuide = useCalligraphyStore(state => state.showGuide);
  const currentStage = useCalligraphyStore(state => state.currentStage);
  const isDrawing = useCalligraphyStore(state => state.isDrawing);
  const setIsDrawing = useCalligraphyStore(state => state.setIsDrawing);
  const incrementStroke = useCalligraphyStore(state => state.incrementStroke);
  const incrementCorrect = useCalligraphyStore(state => state.incrementCorrect);
  const incrementMissed = useCalligraphyStore(state => state.incrementMissed);
  const setShowWrongStroke = useCalligraphyStore(
    state => state.setShowWrongStroke
  );
  const setShowCelebration = useCalligraphyStore(
    state => state.setShowCelebration
  );
  const addCompletedCharacter = useCalligraphyStore(
    state => state.addCompletedCharacter
  );
  

  // Brush configurations
  const brushConfig: Record<
    string,
    {
      baseWidth: number;
      minWidth: number;
      maxWidth: number;
      pressureSensitivity: number;
    }
  > = {
    brush: {
      baseWidth: 12,
      minWidth: 4,
      maxWidth: 20,
      pressureSensitivity: 1.5
    },
    pen: { baseWidth: 5, minWidth: 3, maxWidth: 7, pressureSensitivity: 0.5 },
    pencil: { baseWidth: 2, minWidth: 1, maxWidth: 3, pressureSensitivity: 0.3 }
  };

  // Get current stroke guide - USE ACTUAL DATA from character
  const currentGuideStroke = selectedCharacter?.strokes[currentStrokeIndex];
  const totalStrokes = selectedCharacter?.strokes?.length || 0;

  // Listen for clear and undo events - THIS FIXES THE BUTTONS
  useEffect(() => {
    const handleClear = () => {
      setCompletedStrokes([]);
      setCurrentPoints([]);
    };

    const handleUndo = () => {
      setCompletedStrokes(prev => {
        if (prev.length === 0) return prev;
        return prev.slice(0, -1);
      });
    };

    window.addEventListener('calligraphy:clear', handleClear);
    window.addEventListener('calligraphy:undo', handleUndo);

    return () => {
      window.removeEventListener('calligraphy:clear', handleClear);
      window.removeEventListener('calligraphy:undo', handleUndo);
    };
  }, []);

  // Resize canvas
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  // Draw canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();

    ctx.clearRect(0, 0, rect.width, rect.height);
    drawGrid(ctx, rect.width, rect.height);

    // Draw completed strokes
    completedStrokes.forEach(stroke => {
      drawStroke(ctx, stroke, '#D97706', 0.5);
    });

    // Draw guide stroke
    if (showGuide && currentStage === 'stroke' && currentGuideStroke) {
      drawGuideStroke(ctx, currentGuideStroke, rect);
    }

    // Draw current stroke
    if (currentPoints.length > 1) {
      const strokeColor = isCurrentStrokeValid ? '#D97706' : '#EF4444';
      drawStroke(ctx, currentPoints, strokeColor, 1);
    }

    // Stage 2: Show faded reference
    if (currentStage === 'full' && selectedCharacter) {
      ctx.font = `${rect.height * 0.6}px "Noto Sans JP", sans-serif`;
      ctx.fillStyle = '#D97706';
      ctx.globalAlpha = 0.15;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        selectedCharacter.character,
        rect.width / 2,
        rect.height / 2
      );
      ctx.globalAlpha = 1;
    }
  }, [
    completedStrokes,
    currentPoints,
    currentGuideStroke,
    showGuide,
    currentStage,
    selectedCharacter,
    isCurrentStrokeValid,
    selectedBrushType
  ]);

  // Redraw when state changes
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Reset when character changes
  useEffect(() => {
    setCompletedStrokes([]);
    setCurrentPoints([]);
  }, [selectedCharacter]);

  // Clear when moving to full stage
  useEffect(() => {
    if (currentStage === 'full') {
      setCompletedStrokes([]);
      setCurrentPoints([]);
    }
  }, [currentStage]);

  const drawGrid = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
    ctx.strokeStyle = '#E5E7EB';
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const drawStroke = (
    ctx: CanvasRenderingContext2D,
    points: Point[],
    color: string,
    opacity: number
  ) => {
    if (points.length < 2) return;
    const config = brushConfig[selectedBrushType];
    ctx.strokeStyle = color;
    ctx.globalAlpha = opacity;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const pressureWidth =
        config.minWidth +
        (config.maxWidth - config.minWidth) *
          point.pressure *
          config.pressureSensitivity;
      ctx.lineWidth = Math.min(
        Math.max(pressureWidth, config.minWidth),
        config.maxWidth
      );

      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        const prevPoint = points[i - 1];
        const midX = (prevPoint.x + point.x) / 2;
        const midY = (prevPoint.y + point.y) / 2;
        ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, midX, midY);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const drawGuideStroke = (
    ctx: CanvasRenderingContext2D,
    stroke: { pathData: string; startX: number; startY: number },
    rect: DOMRect
  ) => {
    const scaleX = rect.width / 400;
    const scaleY = rect.height / 350;

    // Yellow guide path
    ctx.save();
    ctx.scale(scaleX, scaleY);
    ctx.strokeStyle = '#F59E0B';
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 8 / Math.min(scaleX, scaleY);
    ctx.lineCap = 'round';
    const path = new Path2D(stroke.pathData);
    ctx.stroke(path);
    ctx.restore();
    ctx.globalAlpha = 1;

    // Green start dot
    const startX = stroke.startX * scaleX;
    const startY = stroke.startY * scaleY;
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(startX, startY, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#22c55e';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(startX, startY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  };

  const getPoint = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, pressure: 0.5 };
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number, pressure: number;

    if ('touches' in e) {
      const touch = e.touches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pressure = (touch as any).force || 0.5;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
      pressure = e.buttons === 1 ? 0.7 : 0.5;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      pressure: Math.max(0.1, Math.min(1, pressure))
    };
  };

  const isNearStartPoint = (point: Point): boolean => {
    if (!currentGuideStroke) return false;
    const container = containerRef.current;
    if (!container) return false;
    const rect = container.getBoundingClientRect();
    const scaleX = rect.width / 400;
    const scaleY = rect.height / 350;
    const startX = currentGuideStroke.startX * scaleX;
    const startY = currentGuideStroke.startY * scaleY;
    return Math.hypot(point.x - startX, point.y - startY) <= 40;
  };

  const isPointOnGuidePath = (point: Point): boolean => {
    if (!currentGuideStroke) return false;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return false;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    const rect = container.getBoundingClientRect();
    const scaleX = rect.width / 400;
    const scaleY = rect.height / 350;
    const px = point.x / scaleX;
    const py = point.y / scaleY;
    const path = new Path2D(currentGuideStroke.pathData);
    ctx.save();
    ctx.lineWidth = 35;
    const isOnPath = ctx.isPointInStroke(path, px, py);
    ctx.restore();
    return isOnPath;
  };

  const calculateStrokeLength = (points: Point[]): number => {
    if (points.length < 2) return 0;
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      length += Math.hypot(
        points[i].x - points[i - 1].x,
        points[i].y - points[i - 1].y
      );
    }
    return length;
  };

  const getExpectedStrokeLength = (): number => {
    if (!currentGuideStroke) return 100;
    const container = containerRef.current;
    if (!container) return 100;
    const rect = container.getBoundingClientRect();
    const scaleX = rect.width / 400;
    const scaleY = rect.height / 350;
    try {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const path = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      );
      path.setAttribute('d', currentGuideStroke.pathData);
      svg.appendChild(path);
      document.body.appendChild(svg);
      const pathLength = path.getTotalLength();
      document.body.removeChild(svg);
      return pathLength * Math.min(scaleX, scaleY);
    } catch {
      return 100;
    }
  };

  // STROKE-BY-STROKE validation
  const validateStrokeByStroke = (
    points: Point[]
  ): { isValid: boolean; reason: string } => {
    if (points.length < 10)
      return { isValid: false, reason: 'Stroke too short' };
    if (!isNearStartPoint(points[0]))
      return { isValid: false, reason: 'Start from the green dot' };

    const sampleRate = Math.max(1, Math.floor(points.length / 15));
    let onPathCount = 0;
    let totalSamples = 0;
    for (let i = 0; i < points.length; i += sampleRate) {
      totalSamples++;
      if (isPointOnGuidePath(points[i])) onPathCount++;
    }
    if (totalSamples > 0 && onPathCount / totalSamples < 0.65) {
      return { isValid: false, reason: 'Follow the yellow guide line' };
    }

    const strokeLength = calculateStrokeLength(points);
    const expectedLength = getExpectedStrokeLength();
    if (strokeLength < expectedLength * 0.5) {
      return { isValid: false, reason: 'Complete the full stroke' };
    }

    return { isValid: true, reason: '' };
  };

  // SELF-PRACTICE validation - requires substantial drawing
  const validateSelfPractice = (
    points: Point[]
  ): { isValid: boolean; reason: string } => {
    if (points.length < 30)
      return { isValid: false, reason: 'Draw more - complete the stroke' };
    const strokeLength = calculateStrokeLength(points);
    if (strokeLength < 80)
      return { isValid: false, reason: 'Stroke too short' };
    return { isValid: true, reason: '' };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const point = getPoint(e);
    if (currentStage === 'stroke' && currentGuideStroke) {
      setIsCurrentStrokeValid(isNearStartPoint(point));
    } else {
      setIsCurrentStrokeValid(true);
    }
    setIsDrawing(true);
    setCurrentPoints([point]);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const point = getPoint(e);

    // Real-time validation
    if (
      currentStage === 'stroke' &&
      isCurrentStrokeValid &&
      currentGuideStroke
    ) {
      if (currentPoints.length % 3 === 0 && !isPointOnGuidePath(point)) {
        setIsCurrentStrokeValid(false);
      }
    }
    setCurrentPoints(prev => [...prev, point]);
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPoints.length < 3) {
      setCurrentPoints([]);
      setIsCurrentStrokeValid(true);
      return;
    }

    let validation: { isValid: boolean; reason: string };

    if (currentStage === 'stroke') {
      validation = validateStrokeByStroke(currentPoints);
      if (!isCurrentStrokeValid) {
        validation = {
          isValid: false,
          reason: 'Stay on the yellow guide line'
        };
      }
    } else {
      validation = validateSelfPractice(currentPoints);
    }

    if (validation.isValid) {
      setCompletedStrokes(prev => [...prev, currentPoints]);
      incrementCorrect();

      if (currentStage === 'stroke') {
        // FIX: Check against ACTUAL totalStrokes from character data
        const nextStrokeIndex = currentStrokeIndex + 1;
        if (nextStrokeIndex >= totalStrokes) {
          // ALL strokes done - celebration then self-practice
          setTimeout(() => setShowCelebration(true), 400);
        } else {
          incrementStroke();
        }
      } else if (currentStage === 'full') {
        // FIX: Need ALL strokes in self-practice too
        const completedCount = completedStrokes.length + 1;
        if (completedCount >= totalStrokes) {
          addCompletedCharacter(selectedCharacter?.character || '');
          setTimeout(() => setShowCelebration(true), 400);
        }
      }
    } else {
      incrementMissed();
      setShowWrongStroke(true);
      setTimeout(() => setShowWrongStroke(false), 1500);
    }

    setCurrentPoints([]);
    setIsCurrentStrokeValid(true);
  };

  return (
    <div
      ref={containerRef}
      className='relative w-full aspect-[4/3] bg-[var(--card-color)] rounded-xl border border-[var(--border-color)] overflow-hidden'
    >
      <canvas
        ref={canvasRef}
        className='absolute inset-0 w-full h-full cursor-crosshair touch-none'
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      />

      {showGuide && currentStage === 'stroke' && currentGuideStroke && (
        <div className='absolute bottom-3 left-3 pointer-events-none'>
          <span className='px-2 py-1 rounded-lg bg-[var(--background-color)]/80 text-[var(--secondary-color)] text-xs backdrop-blur-sm'>
            Start from <span className='text-green-500'>●</span> and follow the
            path
          </span>
        </div>
      )}

      {currentStage === 'stroke' && currentGuideStroke && (
        <div className='absolute top-3 right-3 pointer-events-none'>
          <span className='px-2 py-1 rounded-lg bg-[var(--background-color)]/80 text-[var(--secondary-color)] text-xs backdrop-blur-sm'>
            {currentGuideStroke.name}
          </span>
        </div>
      )}

      {currentStage === 'full' && (
        <div className='absolute bottom-3 left-3 pointer-events-none'>
          <span className='px-2 py-1 rounded-lg bg-[var(--background-color)]/80 text-[var(--secondary-color)] text-xs backdrop-blur-sm'>
            Draw {totalStrokes} strokes from memory ({completedStrokes.length}/
            {totalStrokes})
          </span>
        </div>
      )}

      {!isCurrentStrokeValid && isDrawing && (
        <div className='absolute top-3 left-3 pointer-events-none'>
          <span className='px-2 py-1 rounded-lg bg-red-100 text-red-600 text-xs border border-red-300 animate-pulse'>
            ✕ Off the path!
          </span>
        </div>
      )}
    </div>
  );
};

export default Canvas;
