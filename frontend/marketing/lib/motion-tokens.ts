export const motionTokens = {
  duration: { instant: 0.08, fast: 0.18, normal: 0.35, slow: 0.6, crawl: 1 },
  easing: { smooth: [0.22, 1, 0.36, 1] as const },
  distance: { sm: 8, md: 16, lg: 24 },
  scale: { press: 0.97, pop: 1.02 },
};

export const springs = {
  snappy: { type: "spring" as const, stiffness: 300, damping: 30 },
  gentle: { type: "spring" as const, stiffness: 120, damping: 18 },
};
