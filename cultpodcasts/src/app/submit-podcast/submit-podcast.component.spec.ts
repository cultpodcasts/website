import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubmitPodcastComponent } from './submit-podcast.component';

describe('SubmitPodcastComponent', () => {
  let component: SubmitPodcastComponent;
  let fixture: ComponentFixture<SubmitPodcastComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [SubmitPodcastComponent]
    });
    fixture = TestBed.createComponent(SubmitPodcastComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
