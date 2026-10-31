import { ChangeDetectionStrategy, Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { MatOption } from '@angular/material/core';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { noCompareFunction, regroupSubjects } from '../episode-form.util';
import { SELECT_REORDER, SelectReorderListDirective } from './index';

const ALL = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'];

/** The same shape as the episode / playable dialogs: selected (reorderable), then the rest. */
@Component({
  imports: [ReactiveFormsModule, MatSelectModule, SELECT_REORDER],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-select appSelectReorder [formControl]="control" multiple [sortComparator]="noCompare" (selectionChange)="regroup()">
      @if (selected().length > 0) {
      <div appSelectReorderList (reordered)="onReordered($event)">
        @for (value of selected(); track value) {
        <mat-option appSelectReorderItem [value]="value">{{value}}<app-select-reorder-handle /></mat-option>
        }
      </div>
      }
      @for (value of others(); track value) {
      <mat-option [value]="value">{{value}}</mat-option>
      }
    </mat-select>
  `
})
class HostComponent {
  readonly control = new FormControl<string[]>(['Alpha', 'Bravo', 'Charlie'], { nonNullable: true });
  readonly noCompare = noCompareFunction;
  readonly filter = signal('');
  readonly selected = signal<string[]>([]);
  readonly others = signal<string[]>([]);
  readonly reorderedValues: string[][] = [];

  constructor() {
    this.regroup();
  }

  regroup(): void {
    const grouped = regroupSubjects(this.control.value, ALL, null, [], this.filter());
    this.selected.set(grouped.selectedSubjects);
    this.others.set([...grouped.hoistedSubjects, ...grouped.otherSubjects]);
  }

  onReordered(values: string[]): void {
    this.reorderedValues.push(values);
    this.regroup();
  }
}

describe('select reorder (appSelectReorderList / appSelectReorderItem / app-select-reorder-handle)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let announce: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    announce = vi.fn(() => Promise.resolve());
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection(), { provide: LiveAnnouncer, useValue: { announce } }]
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await settle();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function select(): MatSelect {
    return fixture.debugElement.query(By.directive(MatSelect)).componentInstance as MatSelect;
  }

  function dropList(): CdkDropList {
    return fixture.debugElement.query(By.directive(SelectReorderListDirective)).injector.get(CdkDropList);
  }

  function option(value: string): MatOption {
    const found = select().options.find(o => o.value === value);
    if (!found) {
      throw new Error(`no option ${value}`);
    }
    return found;
  }

  function optionLabels(): string[] {
    return select().options.map(o => o.viewValue);
  }

  /** Projected options are only in the DOM (and the debug tree) while the panel is open. */
  async function drop(previousIndex: number, currentIndex: number): Promise<void> {
    if (!select().panelOpen) {
      select().open();
      await settle();
    }
    const list = dropList();
    list.dropped.emit({ previousIndex, currentIndex, container: list, previousContainer: list } as unknown as CdkDragDrop<unknown>);
  }

  function selectHost(): HTMLElement {
    return fixture.nativeElement.querySelector('mat-select') as HTMLElement;
  }

  function key(key: 'ArrowUp' | 'ArrowDown', altKey = false): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, altKey, bubbles: true, cancelable: true });
    Object.defineProperty(event, 'keyCode', { get: () => (key === 'ArrowUp' ? 38 : 40) });
    selectHost().dispatchEvent(event);
    return event;
  }

  function altArrow(arrow: 'ArrowUp' | 'ArrowDown'): KeyboardEvent {
    return key(arrow, true);
  }

  /** Open the panel and walk the active option down with plain arrows (public behaviour only). */
  async function openWithActive(value: string): Promise<void> {
    select().open();
    await settle();
    for (let i = 0; i < ALL.length && !option(value).active; i++) {
      key('ArrowDown');
      await settle();
    }
    expect(option(value).active).toBe(true);
  }

  function listDirective(): SelectReorderListDirective {
    return fixture.debugElement.query(By.directive(SelectReorderListDirective)).injector.get(SelectReorderListDirective);
  }

  it('renders selected options first, with a right-hand handle that adds no text to the option label', async () => {
    select().open();
    await settle();
    expect(optionLabels()).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']);
    const handles = Array.from(document.querySelectorAll('.mat-mdc-select-panel app-select-reorder-handle'));
    expect(handles.length).toBe(3);
    // The handle is the last thing in the option's text row (CSS pushes it to the right).
    const alpha = option('Alpha')._getHostElement().querySelector('.mdc-list-item__primary-text')!;
    expect(alpha.lastElementChild?.tagName.toLowerCase()).toBe('app-select-reorder-handle');
    expect(select().triggerValue).toBe('Alpha, Bravo, Charlie');
  });

  it('a drop reorders the form value (moveItemInArray) and the host regroups to the new order', async () => {
    await drop(0, 2);
    await settle();
    expect(host.control.value).toEqual(['Bravo', 'Charlie', 'Alpha']);
    expect(host.control.dirty).toBe(true);
    expect(host.reorderedValues).toEqual([['Bravo', 'Charlie', 'Alpha']]);
    expect(host.selected()).toEqual(['Bravo', 'Charlie', 'Alpha']);
    expect(optionLabels().slice(0, 3)).toEqual(['Bravo', 'Charlie', 'Alpha']);
    expect(announce).toHaveBeenCalledWith('Alpha moved to position 3 of 3', 'polite');
  });

  it('a drop at the same index changes nothing', async () => {
    await drop(1, 1);
    await settle();
    expect(host.control.value).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(host.control.dirty).toBe(false);
    expect(host.reorderedValues).toEqual([]);
  });

  it('the reorder survives a later regroup and the typing filter', async () => {
    await drop(2, 0);
    await settle();
    expect(host.control.value).toEqual(['Charlie', 'Alpha', 'Bravo']);

    host.filter.set('ech');
    host.regroup();
    await settle();
    expect(host.selected()).toEqual(['Charlie', 'Alpha', 'Bravo']);
    expect(host.others()).toEqual(['Echo']);

    host.filter.set('');
    host.regroup();
    await settle();
    expect(optionLabels()).toEqual(['Charlie', 'Alpha', 'Bravo', 'Delta', 'Echo']);
    expect(host.control.value).toEqual(['Charlie', 'Alpha', 'Bravo']);
  });

  it('a new selection after a reorder is appended after the reordered ones', async () => {
    await drop(0, 2);
    await settle();
    select().open();
    await settle();
    option('Echo')._selectViaInteraction();
    await settle();
    expect(host.control.value).toEqual(['Bravo', 'Charlie', 'Alpha', 'Echo']);
  });

  it('clicking or pressing on the handle does not toggle the option or close the panel', async () => {
    select().open();
    await settle();
    const handle = option('Bravo')._getHostElement().querySelector('app-select-reorder-handle') as HTMLElement;
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    handle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await settle();
    expect(host.control.value).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(option('Bravo').selected).toBe(true);
    expect(select().panelOpen).toBe(true);
  });

  it('clicking the option text (not the handle) still toggles it', async () => {
    select().open();
    await settle();
    option('Bravo')._getHostElement().click();
    await settle();
    expect(host.control.value).toEqual(['Alpha', 'Charlie']);
  });

  it('swallows only the one stray click that follows the end of a drag; later clicks toggle again', async () => {
    select().open();
    await settle();
    const list = listDirective();
    list.dragStarted();
    list.dragEnded();
    option('Bravo')._getHostElement().click();
    await settle();
    expect(host.control.value).toEqual(['Alpha', 'Bravo', 'Charlie']);

    // One-shot: the very next click (same task) already toggles.
    option('Bravo')._getHostElement().click();
    await settle();
    expect(host.control.value).toEqual(['Alpha', 'Charlie']);
  });

  it('clears the click guard on the next macrotask when no click follows the drag (touch drag)', async () => {
    select().open();
    await settle();
    const list = listDirective();
    list.dragStarted();
    list.dragEnded();
    await new Promise(resolve => setTimeout(resolve));
    option('Charlie')._getHostElement().click();
    await settle();
    expect(host.control.value).toEqual(['Alpha', 'Bravo']);
  });

  it('advertises the keyboard reorder on reorderable options only (aria-keyshortcuts)', async () => {
    select().open();
    await settle();
    expect(option('Alpha')._getHostElement().getAttribute('aria-keyshortcuts')).toBe('Alt+ArrowUp Alt+ArrowDown');
    expect(option('Delta')._getHostElement().hasAttribute('aria-keyshortcuts')).toBe(false);
    expect(option('Alpha').viewValue).toBe('Alpha');
  });

  it('Alt+ArrowDown / Alt+ArrowUp move the active selected option, keep the panel open and announce', async () => {
    await openWithActive('Alpha');
    const down = altArrow('ArrowDown');
    await settle();
    expect(down.defaultPrevented).toBe(true);
    expect(host.control.value).toEqual(['Bravo', 'Alpha', 'Charlie']);
    expect(select().panelOpen).toBe(true);
    expect(option('Alpha').active).toBe(true);
    expect(selectHost().getAttribute('aria-activedescendant')).toBe(option('Alpha').id);
    expect(announce).toHaveBeenLastCalledWith('Alpha moved to position 2 of 3', 'polite');

    altArrow('ArrowDown');
    await settle();
    expect(host.control.value).toEqual(['Bravo', 'Charlie', 'Alpha']);

    altArrow('ArrowUp');
    await settle();
    expect(host.control.value).toEqual(['Bravo', 'Alpha', 'Charlie']);
    expect(optionLabels().slice(0, 3)).toEqual(['Bravo', 'Alpha', 'Charlie']);
  });

  it('Alt+ArrowUp on the first selected option announces it is already first and changes nothing', async () => {
    await openWithActive('Alpha');
    altArrow('ArrowUp');
    await settle();
    expect(host.control.value).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(select().panelOpen).toBe(true);
    expect(announce).toHaveBeenLastCalledWith('Alpha is already first', 'polite');
  });

  it('Alt+Arrow on an option that is not selected keeps mat-select behaviour (closes the panel)', async () => {
    await openWithActive('Delta');
    const event = altArrow('ArrowDown');
    await settle();
    expect(event.defaultPrevented).toBe(true);
    expect(host.control.value).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(select().panelOpen).toBe(false);
  });

  it('plain arrows still move the active option (no reorder)', async () => {
    await openWithActive('Alpha');
    key('ArrowDown');
    await settle();
    expect(host.control.value).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(option('Bravo').active).toBe(true);
  });
});
