import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SendPodcastComponent } from './send-podcast.component';

describe('SendPodcastComponent', () => {
  let component: SendPodcastComponent;
  let fixture: ComponentFixture<SendPodcastComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [SendPodcastComponent]
    });
    fixture = TestBed.createComponent(SendPodcastComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
