# Source documents read for the food data

- Status: Draft
- Owner: Project owner (D-01)
- Last updated: 2026-10-30
- Why they are kept: so that Legal (Q-049) can see exactly what was read before the owner decided
  how dishes are defined (D-26 answer 3, amended 2026-10-30)

The documents from the National Institute of Nutrition (NIN) that were read for the food data.
**The PDFs are not in the repository:** because of NIN's terms (below), the originals are kept
outside it, on the owner's PC in `D:\fitsphere-data\sources\` (owner's decision, 2026-10-30), and
git ignores `docs/sources/*.pdf`. The SHA-256 hashes below identify each file. Each was downloaded
from NIN's own website, not from a third-party copy, and is kept exactly as NIN serves it.

FitSphere uses none of their contents as data. The IFCT 2017 food values come from a compilation of
the first book, `IFCT2017_Nutrient_Knowledge_Base (1).pdf`, kept the same way in `D:\fitsphere-data\`
([`food-list-sources.md`](../data/food-list-sources.md); D-25, accepted risk R-007). D- numbers
refer to [`owner-decisions-2026-10-27.md`](../product/owner-decisions-2026-10-27.md).

## The files

| File | Document | Downloaded from | Downloaded | Pages | Bytes |
|---|---|---|---|--:|--:|
| `IFCT2017.pdf` | *Indian Food Composition Tables 2017*, T. Longvah, R. Ananthan, K. Bhaskarachary and K. Venkaiah (NIN, 2017) | https://www.nin.res.in/ebooks/IFCT2017.pdf | 2026-10-29 | 585 | 12,401,190 |
| `DGI_2024.pdf` | *Dietary Guidelines for Indians*, revised edition 2024 (ICMR-NIN Expert Committee) | https://www.nin.res.in/dietaryguidelines/pdfjs/locale/DGI_2024.pdf, the file NIN's "read online" viewer loads | 2026-10-30 | 148 | 24,471,521 |
| `DietaryGuidelinesforNINwebsite.pdf` | *Dietary Guidelines for Indians – A Manual*, second edition 2011 (NIN) | https://www.nin.res.in/downloads/DietaryGuidelinesforNINwebsite.pdf, linked from NIN's Downloads page | 2026-10-30 | 139 | 5,163,260 |
| `My_Plate_for_the_day_J24.pdf` | *My Plate for the Day* (NIN) | https://www.nin.res.in/downloads/My_Plate_for_the_day_J24.pdf | 2026-10-29 | 4 | 1,867,496 |
| `DGI_Booklet_English_CMYK.pdf` | NIN's short English booklet on the Dietary Guidelines for Indians, linked from NIN's home page | https://www.nin.res.in/downloads/DGI_Booklet_English_CMYK.pdf | 2026-10-29 | 20 | 34,875,560 |

SHA-256:

| File | SHA-256 |
|---|---|
| `IFCT2017.pdf` | `7fc5a5112a57240d25bf695dca82cccd8d93ed54e8c39530e42b5ad1820d0e8c` |
| `DGI_2024.pdf` | `fc4bb5b1ee92a4d3d5dfe5d88eba15be6a50c096b709ce55d2bd4af1a1b91658` |
| `DietaryGuidelinesforNINwebsite.pdf` | `9aef38bd103cb104272e8b57c831b888f4874249431de1c448618d3b03ab6788` |
| `My_Plate_for_the_day_J24.pdf` | `743a36d24ede4cd6cfd816fe349f13bb0c8594dfb2ca43996c68f32c26829be1` |
| `DGI_Booklet_English_CMYK.pdf` | `f8600575719fc5fcb9bd620b639d749d0773fa5ec8f76e598abd95f5681dfac4` |

How they were obtained: one download per file with `curl`. The 2011 manual was also fetched twice
by Claude Code's web-fetch tool; both copies had the hash above. The 2024 guidelines' older link
(`.../pdfjs/locale/DGI24thJune2024fin.pdf`) answered HTTP 404 on 2026-10-29. The
current file name was read from the viewer's script, `pdfjs/viewer.js` (`DEFAULT_URL`).

## What each holds, and its terms

Page numbers are the printed ones, with the page of the PDF file where they differ.

**`IFCT2017.pdf`.** Raw foods, except eggs. The book says Indian food composition tables "have
largely focussed on foods in their raw state" (printed page x), and "Except for eggs, all other food
component data are for foods in the raw form" (printed page i). It does not say how its omelette
(M007) was made, and its tables do not say whether the poultry rows are raw or cooked. Its
copyright page (unnumbered, page 3 of
the PDF) says:

> The use and dissemination of the data in this book is encouraged. This publication can be
> reproduced for personal use with full acknowledgment of the source. However, no part of this
> publication can be stored or reproduced in any electronic format for creating a product without
> the prior written permission of the National Institute of Nutrition, Hyderabad.

The same page asks for this citation, which the app now shows
([`food-list-sources.md`](../data/food-list-sources.md#acknowledgement-text)):

> Longvah, T., Ananthan, R., Bhaskarachary, K. and Venkaiah, K. (2017). Indian Food Composition
> Tables 2017, National Institute of Nutrition, Indian Council of Medical Research, Hyderabad,
> Telangana, India.

**`DGI_2024.pdf`.**
- What it holds: raw food-group amounts, and standard katori sizes (Annexure I, printed
  pp. 111–112).
- Measures of raw foods in household utensils, in diet charts (Annexure II, printed pp. 113–124).
- Infant recipes with raw grams (printed pp. 28, 33–34).
- It gives no weight for one adult dish portion, such as "1 roti".
- Its copyright page (page 3 of the PDF) has nearly the same clause as the IFCT book:

> The use and dissemination of the data in this book is encouraged. This publication can be
> reproduced for personal use with full acknowledgment of the source citation. However, no part of
> this publication can be stored or reproduced in any electronic format for creating a product
> without the prior written permission of the National Institute of Nutrition, Hyderabad.

**`DietaryGuidelinesforNINwebsite.pdf`.**
- Annexure 8, "Approximate Calorific Value of Some Cooked Preparations" (printed pp. 106–107):
  kcal per household serving for 56 dishes, with no grams, protein or ingredients.
- Sample meal plans (Annexure 2a and 2b, printed pp. 87–88).
- Raw food-group portions (Annexure 14, printed p. 117).
- Its notice to readers (page 3 of the PDF) says, among other things:

> Readers are not supposed to either reproduce / copy / reprint the same for commercial purpose.

> Usage of the information should be intimated to the Director, NIN in advance and approval should
> be sought. All copyrights are reserved with NIN.

**`My_Plate_for_the_day_J24.pdf` and `DGI_Booklet_English_CMYK.pdf`.** Food-group amounts and
general advice, with no dish portions. Neither has a copyright or permission statement in its
text.

**NIN's website.** Its footer, read on 2026-10-29 at https://www.nin.res.in/, says:

> All rights reserved for this website. No part of this website may be reproduced, distributed, or
> transmitted in any form or by any means, including photocopying, recording, using scrapping
> automated softwares or other electronic or mechanical methods, without the prior written
> permission of Institute.

Legal's review (Q-049) covers these copies and the use FitSphere makes of what they say. The
questions about them are L-09 to L-11 in the [brief for Legal](../legal/q-049-legal-brief.md).
