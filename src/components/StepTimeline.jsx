import React, { memo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const TimelineItem = memo(function TimelineItem({ item, index }) {
  const [open, setOpen] = useState(Boolean(item.open));

  return (
    <article className={`timeline-item ${open ? 'open' : ''}`}>
      <button type="button" className="timeline-toggle" onClick={() => setOpen((v) => !v)}>
        <span className="timeline-meta">{item.phase}</span>
        <span className="timeline-title">{index + 1}. {item.title}</span>
        <span className="timeline-chevron">›</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.pre
            className="timeline-matrix"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
          >
            {item.matrix}
          </motion.pre>
        )}
      </AnimatePresence>
    </article>
  );
});

const StepTimeline = memo(function StepTimeline({ items }) {
  if (!items?.length) return <div className="timeline-empty">No steps yet. Solve to generate timeline.</div>;

  return (
    <div className="step-timeline">
      {items.map((item, idx) => (
        <TimelineItem key={`${item.phase}-${idx}`} item={item} index={idx} />
      ))}
    </div>
  );
});

export default StepTimeline;
