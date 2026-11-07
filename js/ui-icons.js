// The few icons the cart draws at runtime. Same style as the server-rendered set.
const wrap = (d) => `<svg class="icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><path d="${d}"/></svg>`;

export const icons = { plus: wrap('M12 5v14M5 12h14'), minus: wrap('M5 12h14') };
