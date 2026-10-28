/**
 * 中文界面优先显示 name_zh,未填写或非中文界面回退到日文原名 nickname。
 */
export function localizedName(
  player: { nickname: string; nameZh?: string | null },
  language: string | undefined
): string {
  if (language?.toLowerCase().startsWith('zh') && player.nameZh) return player.nameZh;
  return player.nickname;
}
