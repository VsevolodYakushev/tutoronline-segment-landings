// Block registry in landing-skeleton order (ТЗ §4). Blocks not built yet render nothing.
import { html } from '../html.mjs';
import { quiz as quizBlock } from './quiz.mjs';
import { tutors as tutorsBlock } from './tutors.mjs';
import { header as headerBlock } from './header.mjs';
import { footer as footerBlock } from './footer.mjs';
import { hero as heroBlock } from './hero.mjs';
import { pains as painsBlock } from './pains.mjs';
import { trial as trialBlock } from './trial.mjs';
import { reviews as reviewsBlock } from './reviews.mjs';
import { faq as faqBlock } from './faq.mjs';
import { final as finalBlock } from './final.mjs';
import { oge as ogeBlock } from './oge.mjs';
import { parents as parentsBlock } from './parents.mjs';
import { topbar as topbarBlock } from './topbar.mjs';
import { offer as offerBlock } from './offer.mjs';

const empty = () => '';

export const topbar = topbarBlock;
export const header = headerBlock;
export const hero = heroBlock;
export const pains = painsBlock;
export const trial = trialBlock;
export const oge = ogeBlock;
export const tutors = tutorsBlock;
export const reviews = reviewsBlock;
export const offer = offerBlock;
export const quiz = quizBlock;
export const faq = faqBlock;
export const parents = parentsBlock;
export const final = finalBlock;
export const footer = footerBlock;

// Mobile bottom CTA (FR-028): shown by floating.mjs after the first screen, hidden near the form.
export const sticky = () => html`<div class="m-sticky" data-sticky hidden><a class="btn btn-accent btn-l" href="#form" data-cta="sticky">Забронировать бесплатный урок</a></div>`;
