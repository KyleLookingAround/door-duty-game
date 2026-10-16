// Money and small text helpers, shared by game rules and screens.
export const money = n => (n < 0 ? '−£' : '£') + Math.abs(Math.round(n)).toLocaleString('en-GB');
export const kmoney = n => Math.abs(n) >= 10000 ? (n < 0 ? '−£' : '£') + (Math.abs(n) / 1000).toFixed(Math.abs(n) % 1000 ? 1 : 0) + 'k' : money(n);
export const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
