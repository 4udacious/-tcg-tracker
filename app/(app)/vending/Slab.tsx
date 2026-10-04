'use client'

import ConditionedCard, { type Condition } from './ConditionedCard'

/**
 * A graded card in its case.
 *
 * Proportioned like a real holder - roughly 3.3" x 5.3" around a 2.5" x 3.5"
 * card - so the label strip and the shoulders of plastic around the card read
 * correctly. The branding is this app's own: the shape is the convention, but
 * the marks of an actual grading company are theirs.
 */

const SET_YEAR: Record<string, string> = {
  base1: '1999', base2: '1999', base3: '1999', base5: '2000',
}

const GRADE_LABEL: Record<number, string> = {
  10: 'GEM MINT', 9: 'MINT', 8: 'NM-MT', 7: 'NEAR MINT',
  6: 'EX-MINT', 5: 'EXCELLENT', 4: 'VG-EX',
}

/** Gold for a 10, cooling off as the grade drops. */
function gradeInk(g: number): string {
  if (g >= 10) return '#B8860B'
  if (g >= 9) return '#15803D'
  if (g >= 8) return '#0369A1'
  if (g >= 6) return '#475569'
  return '#78716C'
}

export default function Slab({
  condition, grade, src, alt, name, number, setName, setCode, className = '',
}: {
  condition: Condition
  grade: number
  src: string
  alt: string
  name: string
  number: string
  setName: string
  setCode: string
  className?: string
}) {
  return (
    <div
      className={`relative aspect-[100/161] rounded-[6%] overflow-hidden select-none ${className}`}
      style={{
        // Clear acrylic: barely any body of its own, so whatever sits behind
        // the slab shows through the plastic around the card. What makes it
        // read as a case is the edge - a bright rim where light catches the
        // bevel, a darker outer line, and the drop shadow lifting it off the
        // shelf - rather than any fill.
        background:
          'linear-gradient(145deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.05) 38%, ' +
          'rgba(255,255,255,0.12) 68%, rgba(255,255,255,0.03) 100%)',
        // Slate rather than pure white or black, so the rim holds up on both
        // the light shelf and the dark overlay.
        boxShadow:
          'inset 0 0 0 1px rgba(255,255,255,0.55), ' +
          'inset 0 1.5px 0 rgba(255,255,255,0.7), ' +
          'inset 0 -1px 0 rgba(255,255,255,0.3), ' +
          '0 0 0 1px rgba(100,116,139,0.35), ' +
          '0 6px 18px rgba(15,23,42,0.3)',
        backdropFilter: 'blur(1.5px) saturate(1.06)',
        WebkitBackdropFilter: 'blur(1.5px) saturate(1.06)',
        // The label text sizes off the slab's own width, so one component
        // serves both the shelf thumbnail and the enlarged view.
        containerType: 'inline-size',
      }}
    >
      <div className="absolute inset-0 flex flex-col p-[4.5%] gap-[3%]">
        {/* ── Label ── */}
        <div
          className="rounded-[3.5%] px-[5%] py-[3%] flex items-center gap-[4%] shrink-0"
          style={{
            background: 'linear-gradient(180deg, #ffffff 0%, #f4f3ef 100%)',
            boxShadow: '0 1px 2px rgba(15,23,42,0.18)',
            height: '19%',
          }}
        >
          <div className="min-w-0 flex-1 leading-none">
            <p className="font-semibold truncate text-ink"
               style={{ fontSize: 'clamp(5px, 5.4cqw, 11px)' }}>
              {name}
            </p>
            <p className="font-mono text-muted truncate mt-[3%]"
               style={{ fontSize: 'clamp(4px, 4cqw, 8px)' }}>
              {setName}{SET_YEAR[setCode] ? ` · ${SET_YEAR[setCode]}` : ''} · #{number}
            </p>
            {/* Longer than the old mark, so slightly tighter tracking and a
                truncate guard keep it on one line at thumbnail width. */}
            <p className="font-mono tracking-[0.1em] text-muted/70 mt-[4%] truncate"
               style={{ fontSize: 'clamp(3px, 3.1cqw, 6px)' }}>
              WAPC AUTHENTICATION
            </p>
          </div>

          <div className="shrink-0 text-right leading-none">
            <p className="font-display font-bold" style={{
              fontSize: 'clamp(11px, 13cqw, 26px)', color: gradeInk(grade),
            }}>
              {grade}
            </p>
            <p className="font-mono tracking-wider text-muted mt-[6%]"
               style={{ fontSize: 'clamp(3px, 3.4cqw, 7px)' }}>
              {GRADE_LABEL[grade] ?? 'GRADED'}
            </p>
          </div>
        </div>

        {/* ── The card, held inside the case ── */}
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div
            className="h-full aspect-[245/342] rounded-[2%] overflow-hidden"
            // A touch more shadow than before: with the case now clear, this
            // is what tells you the card is suspended behind plastic rather
            // than lying on top of it.
            style={{ boxShadow: '0 0 0 1px rgba(15,23,42,0.14), 0 2px 7px rgba(15,23,42,0.3)' }}
          >
            <ConditionedCard
              src={src} alt={alt} condition={condition} detail="full"
              className="w-full h-full"
            />
          </div>
        </div>
      </div>

      {/* Gloss across the face, and a brighter catch along the top edge. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(118deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.08) 26%, ' +
            'rgba(255,255,255,0) 44%, rgba(255,255,255,0) 72%, rgba(255,255,255,0.22) 100%)',
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-[2%] pointer-events-none"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0))' }}
      />
    </div>
  )
}
