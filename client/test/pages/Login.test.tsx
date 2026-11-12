import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderAtRoute } from '../render';
import Login from '../../src/pages/Login';

const apiPost = vi.hoisted(() => vi.fn());
const powProgress = vi.hoisted(() => ({ active: false, percent: 0 }));
const captchaConfig = vi.hoisted(() => vi.fn());

vi.mock('../../src/api/client', () => ({
  api: { post: apiPost },
  errMsg: vi.fn(() => '请求失败'),
}));
vi.mock('../../src/api/socket', () => ({ closeSocket: vi.fn(), getSocket: vi.fn() }));
vi.mock('../../src/api/session', () => ({ markAuthenticated: vi.fn() }));
vi.mock('../../src/components/Toast', () => ({ toast: { error: vi.fn() } }));
vi.mock('../../src/api/captcha', () => ({ getCaptchaConfig: captchaConfig }));
vi.mock('../../src/components/TurnstileWidget', () => ({ default: () => null }));
vi.mock('../../src/api/geetest', () => ({ requestGeeTest: vi.fn() }));
vi.mock('../../src/api/pow', () => ({
  getPowProgress: () => powProgress,
  subscribePowProgress: () => () => undefined,
}));

describe('registration validation', () => {
  beforeEach(() => {
    apiPost.mockReset();
    captchaConfig.mockReset();
    captchaConfig.mockResolvedValue({ turnstile: { enabled: false }, geetest: { enabled: false } });
  });

  it('shows actionable errors beside every invalid registration field', async () => {
    const user = userEvent.setup();
    renderAtRoute(<Login />, { route: '/login', path: '/login' });

    await user.click(screen.getByRole('button', { name: '没有账号？去注册' }));
    const username = screen.getByPlaceholderText('用户名');
    await user.type(username, 'bad name');
    await user.type(screen.getByPlaceholderText('密码（至少 10 位）'), 'short');
    await user.type(screen.getByPlaceholderText('确认密码'), 'different');
    await user.click(screen.getByRole('button', { name: '注册' }));

    expect(screen.getByText('用户名只能包含字母、数字、下划线、连字符和中文')).toBeInTheDocument();
    expect(screen.getByText('密码长度必须为 10-128 个字符')).toBeInTheDocument();
    expect(screen.getByText('两次输入的密码不一致')).toBeInTheDocument();
    expect(username).toHaveFocus();
    expect(apiPost).not.toHaveBeenCalled();

    await user.clear(username);
    await user.type(username, 'a');
    await user.click(screen.getByRole('button', { name: '注册' }));
    expect(screen.getByText('用户名长度必须为 2-20 个字符')).toBeInTheDocument();
  });

  it('uses Turnstile first and offers the GeeTest fallback', async () => {
    captchaConfig.mockResolvedValue({
      turnstile: { enabled: true, siteKey: 'site-key' },
      geetest: { enabled: true, captchaId: 'captcha-id' },
    });
    const user = userEvent.setup();
    renderAtRoute(<Login />, { route: '/login', path: '/login' });

    await user.click(screen.getByRole('button', { name: '没有账号？去注册' }));
    const fallback = await screen.findByRole('button', { name: '国内网络？改用 GeeTest 验证' });
    expect(screen.getByRole('button', { name: '注册' })).toBeDisabled();

    await user.click(fallback);
    expect(screen.getByText('点击注册后会弹出 GeeTest 验证。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '注册' })).toBeEnabled();
  });
});
