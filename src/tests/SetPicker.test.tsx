import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SetPicker from '../components/SetPicker';

const sets = [
  { id: 'set-1', name: 'First Set' },
  { id: 'set-2', name: 'Second Set' },
];

describe('SetPicker', () => {
  it('shows login prompt when no user', () => {
    render(<SetPicker user={null} sets={[]} selectedSetId="" saving={false} onSetChange={vi.fn()} />);
    expect(screen.getByText('Log in to annotate')).toBeInTheDocument();
  });

  it('login prompt links to /login', () => {
    render(<SetPicker user={null} sets={[]} selectedSetId="" saving={false} onSetChange={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Log in to annotate' })).toHaveAttribute('href', '/login');
  });

  it('shows "Create set" link when user has no sets', () => {
    render(<SetPicker user={{ id: 'u1' }} sets={[]} selectedSetId="" saving={false} onSetChange={vi.fn()} />);
    expect(screen.getByText('Create set')).toBeInTheDocument();
  });

  it('"Create set" links to /sets', () => {
    render(<SetPicker user={{ id: 'u1' }} sets={[]} selectedSetId="" saving={false} onSetChange={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Create set' })).toHaveAttribute('href', '/sets');
  });

  it('renders set options when user has sets', () => {
    render(<SetPicker user={{ id: 'u1' }} sets={sets} selectedSetId="set-1" saving={false} onSetChange={vi.fn()} />);
    expect(screen.getByRole('option', { name: 'First Set' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Second Set' })).toBeInTheDocument();
  });

  it('select reflects selectedSetId', () => {
    render(<SetPicker user={{ id: 'u1' }} sets={sets} selectedSetId="set-2" saving={false} onSetChange={vi.fn()} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('set-2');
  });

  it('calls onSetChange with new set id on change', () => {
    const onSetChange = vi.fn();
    render(<SetPicker user={{ id: 'u1' }} sets={sets} selectedSetId="set-1" saving={false} onSetChange={onSetChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'set-2' } });
    expect(onSetChange).toHaveBeenCalledWith('set-2');
  });

  it('shows saving indicator when saving=true', () => {
    render(<SetPicker user={{ id: 'u1' }} sets={sets} selectedSetId="set-1" saving={true} onSetChange={vi.fn()} />);
    expect(screen.getByText('Saving…')).toBeInTheDocument();
  });

  it('hides saving indicator when saving=false', () => {
    render(<SetPicker user={{ id: 'u1' }} sets={sets} selectedSetId="set-1" saving={false} onSetChange={vi.fn()} />);
    expect(screen.queryByText('Saving…')).toBeNull();
  });
});
