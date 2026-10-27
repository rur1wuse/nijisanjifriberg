import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderAtRoute } from '../render';
import Search from '../../src/pages/Search';

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('../../src/api/client', () => ({
  api: { get: apiGet },
  errMsg: () => 'request failed',
}));

const player = {
  id: 1,
  nickname: '月ノ美兎',
  gender: '女',
  debutDate: '2018-02-08',
  height: '151cm',
  age: '16歳',
  collab: 'JK組、さんばかJK組',
  race: '人类',
  difficulties: ['normal'],
};

describe('Search page', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockImplementation(async (url: string) => {
      if (url === '/players/list') {
        return { status: 200, data: { version: '1', players: [{ id: player.id, nickname: player.nickname }] } };
      }
      return { status: 200, data: [player] };
    });
  });

  it('renders every niji attribute returned by the players API', async () => {
    const user = userEvent.setup();
    renderAtRoute(<Search />);

    await user.type(screen.getByRole('combobox'), '月ノ美兎');
    await user.click(screen.getByRole('button', { name: '查询' }));

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/players', {
      params: { search: '月ノ美兎' },
    }));

    const table = await screen.findByRole('table');
    for (const value of ['女', '2018-02-08', '151cm', '16歳', 'JK組、さんばかJK組', '人类']) {
      expect(table.textContent).toContain(value);
    }
  });
});
