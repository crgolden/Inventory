import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { newHttpsAddress } from '@crgolden/modules/testing';
import { ManualChatPanelComponent } from './manual-chat-panel.component';

describe('ManualChatPanelComponent', () => {
  let fixture: ComponentFixture<ManualChatPanelComponent>;
  let component: ManualChatPanelComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManualChatPanelComponent],
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ManualChatPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the collapsed Find Manual toggle by default', () => {
    expect(component.isOpen()).toBe(false);
    expect(fixture.debugElement.query(By.css('#manual-chat-toggle'))).toBeTruthy();

    expect(fixture.debugElement.query(By.css('#manual-chat-panel'))).toBeNull();
  });

  it('open() expands the panel and hides the toggle', () => {
    component.open();
    fixture.detectChanges();

    expect(component.isOpen()).toBe(true);
    expect(fixture.debugElement.query(By.css('#manual-chat-panel'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('#manual-chat-toggle'))).toBeNull();
  });

  it('close() collapses the panel and shows the toggle again', () => {
    component.open();
    fixture.detectChanges();
    component.close();
    fixture.detectChanges();

    expect(component.isOpen()).toBe(false);
    expect(fixture.debugElement.query(By.css('#manual-chat-toggle'))).toBeTruthy();
  });

  it('re-emits manualUrlSelected from the hosted chat component', () => {
    const emitted: string[] = [];
    component.manualUrlSelected.subscribe((v) => emitted.push(v));
    const manualUrl = newHttpsAddress();
    component.onUrlSelected(manualUrl);
    expect(emitted).toEqual([manualUrl]);
  });
});
