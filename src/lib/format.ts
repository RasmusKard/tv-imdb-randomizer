/** 534836 -> "534 836": the ledger groups thousands with spaces, never commas. */
export const groupThousands = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
