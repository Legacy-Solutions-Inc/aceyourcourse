# Graph Report - aceyourcourse (2026-11-17)

## Corpus Check

- Large corpus: 890 files · ~697,751 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary

- 5173 nodes · 15519 edges · 167 communities (151 shown, 16 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 339 edges (avg confidence: 0.86)
- Token cost: 794,885 input · 0 output

## Community Hubs (Navigation)

- Website Component Tests
- Reviews & Best Sellers UI
- Upload Storage Seam
- Admin Tickets & Conventions
- Admin Form Schemas
- Site Footer & Promo Strip
- DB Schema & Seed Tests
- Admin Action Editors
- Staff Accounts & Invites
- Admin Prompts 01-12
- Sample Store & Exam Pages
- DB Check & Add Owner
- Products Page Filters
- Product Page & Cards
- Admin Exam Pages View
- Admin Prompts 13-25
- Overview Needs Attention
- Catalogue Service Reads
- Admin Permission Tests
- Product & FAQ Editors
- Catalogue Seed CLI
- About Page Content
- Catalogue Schema & Bucket
- Admin Service Contract
- Config & Middleware
- About Photo Editors
- llms.txt & Domain Types
- Admin Types & Writes
- Admin DB Rows
- Admin Server Actions
- Sidebar UI Primitives
- Exam Page Editors
- Review Editor
- Reviews & FAQ Lists
- Domain Glossary & ADRs
- Legal Pages
- Catalogue DB Rows
- Admin Form Hook
- Storage & Reset Route
- README, CI & Seam ADRs
- App Layout & OG Images
- Catalogue Import Runner
- Home Page Hero
- Mock FAQs Store
- Review & FAQ Actions
- Admin Product List
- v1 Spec & Mockup Maps
- Mock Products Store
- Paths & Exam Hero
- Site Navigation
- Retired Tenancy Specs
- Staff Guard
- Spreadsheet Parsing
- Admin Settings Page
- Catalogue Read Rules
- Identity & Sign-in Method
- Admin Products Page
- Admin Sign-in Flow
- Product Panel & Delete
- Hero Video & Carousels
- Mock Staff Store
- Spreadsheet Build
- Admin E2E Helpers
- Admin Shell & Sidebar
- Runtime Dependencies
- Dev Dependencies
- Mock Exam Pages Store
- Admin Sign-in Page
- SEO Editors & Check
- Admin Review List
- Mock Reviews Store
- Product Form & Peso
- Promo & Announcement
- Website E2E Specs
- Package Tooling
- Dialog & Error UI
- Admin Arms Tests
- Sitemap & SEO
- Import Photo Staging
- npm Scripts
- Staff E2E Spec
- TypeScript Config
- Seam & Clean Arch Skills
- Website Settings Admin
- Product Photos E2E
- FAQ Editor Tests
- Drizzle & RLS Skills
- shadcn Config
- Sitewide A11y E2E
- Catalogue SQL Schema
- Next.js, CSP & PostHog Skills
- UI & Forms Skills
- Secrets & Env Guards
- Dropdown Menu UI
- Website Shell Ticket
- Mockup Data Script
- Promo E2E Spec
- Chart UI
- Form & Label UI
- FAQ Explorer
- Import Test Fixtures
- Logger
- Product & Reviews Tickets
- Website Ticket Plan
- Mission Tabs
- E2E Server Env
- Coding Standards & Commits
- Admin Journey E2E
- Announcement Bar
- Exam Pages Service Tests
- Settings E2E Spec
- SEO Editor Tests
- Product Editor Tests
- Exam Schema Tests
- Supabase Auth Skill
- Password Sign-in Form
- Products Page Tests
- Select UI
- Admin Action Tests
- FAQ Page Ticket
- Mockup Unbundle Tool
- FAQs E2E Spec
- Product Editor E2E
- FAQ E2E Spec
- Products E2E Spec
- Identity Live Tests
- Exam Copy & Text
- Row Diff
- Fake Next Cache
- Claude Agent Config
- Exam Pages E2E
- Products List E2E
- Admin Reviews E2E
- Reviews E2E Spec
- ESLint Config
- Subject Chips
- Admin Reviews Tests
- Site Pages E2E
- PostHog Instrumentation
- About Page Ticket
- Products Page Ticket
- Home Bottom Ticket
- PostHog Handoff
- Exam E2E Spec
- Prettier Config
- Sitemap Ticket
- Add Exam E2E
- Admin Header
- Fake Upload Request
- Admin SQL Schema
- React 19 Reference
- Home Top Ticket
- Exam Pages Ticket
- Drizzle Kit
- Volta Toolchain
- Issue Templates
- CodeQL Workflow
- Tailwind PostCSS Dep
- PostCSS Config
- Site Pages SQL

## God Nodes (most connected - your core abstractions)

1. `cn()` - 281 edges
2. `vitest` - 250 edges
3. `next` - 123 edges
4. `react` - 107 edges
5. `getSampleStore()` - 100 edges
6. `StaffActor` - 99 edges
7. `@testing-library/react` - 88 edges
8. `paths` - 86 edges
9. `AdminAction` - 76 edges
10. `Phase 2 (Admin) shared conventions` - 73 edges

## Surprising Connections (you probably didn't know these)

- `About photo warnings (not 4:3, smaller than 1200x900)` --semantically_similar_to--> `shareImageWarning()` [INFERRED] [semantically similar]
  .scratch/ayc-admin/prompts/21-about-page-editor.md → src/lib/admin/exam-pages-view.ts
- `Site page (Home, Products, Reviews, About, FAQ)` --references--> `validateCatalogueSeed()` [INFERRED]
  .scratch/ayc-admin/prompts/20-site-page-seo.md → src/services/catalogue.schema.ts
- `ADR 0012: Host on Vercel Pro and Supabase Pro in Singapore` --references--> `docker-compose standalone self-host` [INFERRED]
  docs/adr/0012-vercel-and-supabase-singapore.md → docker-compose.yml
- `Executer prompt 23: Add Exams and Subjects` --references--> `AdminAction` [EXTRACTED]
  .scratch/ayc-admin/prompts/23-add-exams-and-subjects.md → src/lib/admin/action.ts
- `Owners add/delete Exams and Subjects in Pages & promo` --references--> `AdminAction` [EXTRACTED]
  .scratch/ayc-admin/prompts/23-add-exams-and-subjects.md → src/lib/admin/action.ts

## Import Cycles

- None detected.

## Hyperedges (group relationships)

- **Server Action Security Flow (re-auth, authz, validate, seam)** — _claude_skills_coding_standards_skill_in_action_authz, _claude_skills_forms_validation_skill_two_boundary_validation, _claude_skills_nextjs_app_router_references_server_actions_server_action_write_pattern, _claude_skills_supabase_auth_skill_getuser_not_getsession, _claude_skills_supabase_auth_skill_staff_list_authorization [INFERRED 0.85]
- **Nonce CSP Defense-in-Depth** — _claude_skills_coding_standards_skill_strict_nonce_csp, _claude_skills_nextjs_app_router_skill_csp_middleware, _claude_skills_nextjs_app_router_skill_dynamic_root_layout, _claude_skills_posthog_skill_session_replay_worker_src, _claude_skills_posthog_skill_relay_reverse_proxy [INFERRED 0.85]
- **Planning to Executer Handoff Workflow** — _claude_readme_planning_executer_model, _claude_readme_prompt_architect_standing_rule, _claude_commands_handoff_handoff_command, _claude_commands_handoff_risen_framework, _claude_commands_handoff_handoff_prompt_sections [EXTRACTED 1.00]
- **Access check model: Plan, Access Pass, Course Ownership, Free Preview** — context_plan, context_access_pass, context_course_ownership, context_free_preview, docs_adr_0010_access_follows_the_exam_three_access_questions [EXTRACTED 1.00]
- **Mock-first data architecture behind the Service Seam** — context_service_seam, docs_adr_0003_mock_first_service_seam, docs_adr_0006_drizzle_data_layer, docs_adr_0006_drizzle_data_layer_mock_db_selector, docs_adr_0006_drizzle_data_layer_lazy_db_client, docs_adr_0004_rsc_server_actions_first_rsc_reads_server_action_writes, context_reference_feature [INFERRED 0.85]
- **CI parallel jobs sharing the setup action** — _github_workflows_ci_verify, _github_workflows_ci_database, _github_workflows_ci_e2e_website, _github_workflows_ci_e2e_admin, _github_workflows_ci_e2e_admin_live, _github_workflows_ci_dependency_review, _github_actions_setup_action [EXTRACTED 1.00]
- **AYC v1 behaviour-tested seams** — docs_specs_2026_10_29_ayc_v1_catalogue_seam, docs_specs_2026_10_29_ayc_v1_access_decision_seam, docs_specs_2026_10_29_ayc_v1_progress_calculator, docs_specs_2026_10_29_ayc_v1_order_ledger [EXTRACTED 1.00]
- **Three Surfaces and their mockup build maps** — docs_specs_2026_10_29_ayc_v1_website_surface, docs_specs_2026_10_29_ayc_v1_admin_surface, docs_specs_2026_10_29_ayc_v1_member_app_surface, docs_mockup_website_build_map, docs_mockup_admin_build_map, docs_mockup_member_app_build_map [INFERRED 0.85]
- **/relay path kept in sync across rewrites, client api_host and middleware matcher** — docs_superpowers_handoffs_2026_07_31_posthog_analytics_relay_reverse_proxy, docs_superpowers_handoffs_2026_07_31_posthog_analytics_instrumentation_client, docs_superpowers_handoffs_2026_07_31_posthog_analytics_middleware_matcher_exclusion [EXTRACTED 1.00]
- **Website pages consuming the Catalogue Service Seam and Product/Review contract** — _scratch_ayc_website_issues_01_branded_website_shell_catalogue_service_seam, _scratch_ayc_website_issues_02_product_page_product_review_read_contract, _scratch_ayc_website_issues_03_products_page, _scratch_ayc_website_issues_04_exam_pages, _scratch_ayc_website_issues_05_home_top_half, _scratch_ayc_website_issues_07_reviews_page, _scratch_ayc_website_issues_09_about_page, _scratch_ayc_website_issues_11_sitemap_and_site_checks [INFERRED 0.85]
- **Features gated by the Member App switch** — _scratch_ayc_website_issues_01_branded_website_shell_member_app_switch, _scratch_ayc_website_issues_03_products_page_help_me_choose_picker, _scratch_ayc_website_issues_08_faq_page_faq_seam, _scratch_ayc_website_issues_11_sitemap_and_site_checks_sitewide_checks, _scratch_ayc_website_issues_05_home_top_half, _scratch_ayc_website_issues_02_product_page [EXTRACTED 1.00]
- **Website structured data builders (no rating/review markup)** — _scratch_ayc_website_issues_02_product_page_no_rating_review_markup, _scratch_ayc_website_prompts_02_product_page_productjsonld, _scratch_ayc_website_prompts_08_faq_page_faqpagejsonld, _scratch_ayc_website_prompts_11_sitemap_and_site_checks_organizationjsonld, _scratch_ayc_website_issues_11_sitemap_and_site_checks_organization_json_ld, _scratch_ayc_website_issues_08_faq_page_faqpage_json_ld [INFERRED 0.85]
- **Admin write flow: action -> Guard -> seam -> conflict -> Staff Activity -> cache tags** — _scratch_ayc_admin_conventions_adminaction, _scratch_ayc_admin_conventions_staff_guard, _scratch_ayc_admin_conventions_admin_seam, _scratch_ayc_admin_conventions_conflict_check, _scratch_ayc_admin_conventions_staff_activity, _scratch_ayc_admin_conventions_cache_tags [EXTRACTED 1.00]
- **Stage B database rollout (tickets 13-18)** — _scratch_ayc_admin_issues_13_local_supabase_foundation, _scratch_ayc_admin_issues_14_catalogue_on_the_database, _scratch_ayc_admin_issues_15_admin_writes_on_the_database, _scratch_ayc_admin_issues_16_real_staff_sign_in, _scratch_ayc_admin_issues_17_photo_storage, _scratch_ayc_admin_issues_18_production_go_live [EXTRACTED 1.00]
- **Staff sign-in method evolution (sample list, Google OAuth, dev password, temporary prod password)** — _scratch_ayc_admin_issues_01_admin_shell_and_sign_in, _scratch_ayc_admin_issues_16_real_staff_sign_in_live_mode_google_oauth, _scratch_ayc_admin_issues_19_development_password_sign_in_dev_password_box, _scratch_ayc_admin_issues_24_password_sign_in_in_production_admin_password_sign_in_switch, _scratch_ayc_admin_conventions_identity_amr_rule [INFERRED 0.85]
- **Shared Admin save path (Guard, adminAction, conflict check, Staff Activity, cache tags)** — _scratch_ayc_admin_prompts_01_admin_shell_and_sign_in_staff_guard, _scratch_ayc_admin_prompts_02_settings_and_save_path_admin_action, _scratch_ayc_admin_prompts_02_settings_and_save_path_conflict_check, _scratch_ayc_admin_prompts_02_settings_and_save_path_staff_activity, _scratch_ayc_admin_prompts_02_settings_and_save_path_catalogue_cache_tags, _scratch_ayc_admin_prompts_02_settings_and_save_path_save_state_line [EXTRACTED 1.00]
- **Staff sign-in decision flow** — _scratch_ayc_admin_prompts_01_admin_shell_and_sign_in_staff_guard, _scratch_ayc_admin_prompts_01_admin_shell_and_sign_in_invite_activation, _scratch_ayc_admin_prompts_01_admin_shell_and_sign_in_denied_403_screen, _scratch_ayc_admin_prompts_01_admin_shell_and_sign_in_denied_sign_in_record, _scratch_ayc_admin_prompts_01_admin_shell_and_sign_in_safe_next, _scratch_ayc_admin_prompts_01_admin_shell_and_sign_in_admin_closed_in_production [EXTRACTED 1.00]
- **FAQ quote integrity across Reviews, FAQs and Product delete** — _scratch_ayc_admin_prompts_07_reviews_faq_quote_guard, _scratch_ayc_admin_prompts_08_faqs_faq_quote_picker, _scratch_ayc_admin_prompts_05_product_editor_product_delete_cascade, src_services_catalogue_schema [INFERRED 0.85]
- **Staff sign-in method policy (live mode, amr rule, dev box, production switch)** — _scratch_ayc_admin_prompts_16_real_staff_sign_in_live_mode, _scratch_ayc_admin_prompts_19_development_password_sign_in_amr_method_rule, _scratch_ayc_admin_prompts_19_development_password_sign_in_development_password_sign_in, _scratch_ayc_admin_prompts_24_password_sign_in_in_production_admin_password_sign_in_switch, src_lib_admin_sign_in_method, _scratch_ayc_admin_prompts_24_password_sign_in_in_production_pure_password_decision [INFERRED 0.85]
- **Stage B: Admin moves from sample data to Supabase (tickets 13-18)** — _scratch_ayc_admin_prompts_13_local_supabase_foundation, _scratch_ayc_admin_prompts_14_catalogue_on_the_database, _scratch_ayc_admin_prompts_15_admin_writes_on_the_database, _scratch_ayc_admin_prompts_16_real_staff_sign_in, _scratch_ayc_admin_prompts_17_photo_storage, _scratch_ayc_admin_prompts_18_production_go_live [EXTRACTED 1.00]
- **Milestone 2 self-editable content (Site page SEO, About editor, llms.txt, add Exams)** — _scratch_ayc_admin_prompts_20_site_page_seo_contract_milestone_2, _scratch_ayc_admin_prompts_20_site_page_seo_site_page, _scratch_ayc_admin_prompts_21_about_page_editor_about_page_editor, src_app_llms_txt_route, _scratch_ayc_admin_prompts_23_add_exams_and_subjects_add_exam_owner_only [INFERRED 0.85]

## Communities (167 total, 16 thin omitted)

### Community 0 - "Website Component Tests"

Cohesion: 0.02
Nodes (90): @testing-library/react, @testing-library/user-event, vitest, APP_QUESTIONS, FaqPageJsonLd, USERS, EXAMS, section() (+82 more)

### Community 1 - "Reviews & Best Sellers UI"

Cohesion: 0.03
Nodes (94): HeroFigure(), HeroLabel(), ReviewsPage(), ReviewsPageProps, cardQuoting(), cards(), firstCard(), PageModule (+86 more)

### Community 2 - "Upload Storage Seam"

Cohesion: 0.04
Nodes (83): ANSWERS, GET(), notFound(), PUT(), RouteContext, context(), EDITOR, idOf() (+75 more)

### Community 3 - "Admin Tickets & Conventions"

Cohesion: 0.04
Nodes (91): Phase 2 (Admin) shared conventions, Admin mockup look (AdminDashboard_v2, Website tokens, light-only), Admin seam (src/services/admin.ts) write contract, adminAction helper (Guard, zod, seam, revalidateTag), AdminResult / AdminError / StaffActor types, paths.admin route table (src/paths.ts), Playwright admin project (e2e/admin, workers 1, resetSampleData, signInAs), Staff Activity record (before/after per entity changed) (+83 more)

### Community 4 - "Admin Form Schemas"

Cohesion: 0.03
Nodes (101): isOnHost(), ABOUT_ALT_MISSING, aboutPhotoField, aboutSectionFields, aboutSectionFormSchema, AboutSectionUpdate, aboutSectionUpdate(), aboutText (+93 more)

### Community 5 - "Site Footer & Promo Strip"

Cohesion: 0.05
Nodes (61): Promo status line helper (ON, SCHEDULED, ENDED, OFF), IloiloRootsProps, section(), SHOP_LINKS, shopButtons(), stores(), ComingSoonNote(), SHOP_LINKS (+53 more)

### Community 6 - "DB Schema & Seed Tests"

Cohesion: 0.04
Nodes (66): drizzle-orm, postgres, db(), photos(), products(), supabaseUrl(), LOCAL, CONNECT_TIMEOUT_SECONDS (+58 more)

### Community 7 - "Admin Action Editors"

Cohesion: 0.05
Nodes (69): sonner, RootLayout(), AdminSwitch(), AdminSwitchProps, IDLE, REDIRECT, State, ConfirmDeleteProps (+61 more)

### Community 8 - "Staff Accounts & Invites"

Cohesion: 0.05
Nodes (69): AdminDialog(), AdminDialogButton(), AdminDialogButtons(), AdminDialogProps, AdminDialogTone, BARS, BUTTONS, callAdminAction() (+61 more)

### Community 9 - "Admin Prompts 01-12"

Cohesion: 0.05
Nodes (64): Executer prompt 01: Admin shell and Staff sign-in, Admin seam (src/services/admin.ts, admin.types, admin.mock), Admin shell: sidebar, header with SAMPLE DATA tag, user block, mobile drawer, 403 denied screen with logged attempt, Denied sign-in attempt recording (recordDeniedSignIn), Invite activation on first sign-in (resolveSignIn), Manila-time greeting and date line, safe-next redirect accepting /admin paths only (+56 more)

### Community 10 - "Sample Store & Exam Pages"

Cohesion: 0.05
Nodes (41): fixCpaSearch(), { jar }, NOW, renderOverview(), reads, sitemapPaths(), sitemapUrls(), ContentModule (+33 more)

### Community 11 - "DB Check & Add Owner"

Cohesion: 0.05
Nodes (59): One-time signed upload URL (createSignedUploadUrl), dotenv, addOwner(), AddOwnerCommand, AddOwnerOutcome, addOwner(), DEPLOYMENT_ACTOR, planOwner() (+51 more)

### Community 12 - "Products Page Filters"

Cohesion: 0.06
Nodes (57): examList, ProductsPage(), ProductsPageProps, CountNoun, FilterChip(), FilterChipGroup(), FilterChipProps, renderGroup() (+49 more)

### Community 13 - "Product Page & Cards"

Cohesion: 0.08
Nodes (52): findProduct, generateMetadata(), ProductPage(), ProductPageProps, EDITOR, postersOnTheWebsite(), ExamPanel(), ProductRow() (+44 more)

### Community 14 - "Admin Exam Pages View"

Cohesion: 0.06
Nodes (64): cePage(), createShareImageUpload, EDITOR, IDLE, { jar }, opened(), announcementEditor(), ExamPagesPage() (+56 more)

### Community 15 - "Admin Prompts 13-25"

Cohesion: 0.06
Nodes (51): Executer prompt 13: Local Supabase foundation, pnpm test:db (*.db.test.ts, node env), Executer prompt 14: Catalogue on the database, catalogue:seed --production refuses when data exists, Equivalence test: every Website query deep-equals across both arms, Executer prompt 15: Admin writes on the database, POST /api/dev/sample-data/reset re-seeds only a local database, Staff Activity record (staff_activity table) (+43 more)

### Community 16 - "Overview Needs Attention"

Cohesion: 0.06
Nodes (59): metadata, OverviewPage(), NeedsAttentionList(), TONE, ACTIONS, QuickActions(), AttentionItem, AttentionKind (+51 more)

### Community 17 - "Catalogue Service Reads"

Cohesion: 0.07
Nodes (52): dynamic, GET(), PLAIN_TEXT, summary(), AboutPage(), generateMetadata(), readAbout(), EDITOR (+44 more)

### Community 18 - "Admin Permission Tests"

Cohesion: 0.04
Nodes (46): ADMIN_DIR, EDITOR, EDITOR_SAVES, editorSave(), ENTRIES, Entry, GUARDED, IDLE (+38 more)

### Community 19 - "Product & FAQ Editors"

Cohesion: 0.06
Nodes (58): AnnouncementEditor(), add(), edit(), move(), remove(), setMessages(), AnnouncementEditorProps, Message (+50 more)

### Community 20 - "Catalogue Seed CLI"

Cohesion: 0.07
Nodes (47): staff and denied_sign_ins tables, CATALOGUE_BUCKET, describeSeedFailure(), dryRun(), HINTS, runCatalogueSeed(), SeedCommand, seedProblems() (+39 more)

### Community 21 - "About Page Content"

Cohesion: 0.06
Nodes (49): Field limit = ~1.5x default length rounded up to next 10, ctaTiles(), loadPage(), nowLine(), PageModule, reads, renderAbout(), renderAboutFromSeed() (+41 more)

### Community 22 - "Catalogue Schema & Bucket"

Cohesion: 0.04
Nodes (56): nextConfig, securityHeaders, bucketObjectPath(), bucketPublicUrl(), isBucketImageUrl(), parse(), StorageImagePattern, storageImagePatterns() (+48 more)

### Community 23 - "Admin Service Contract"

Cohesion: 0.08
Nodes (8): ROLE_LABEL, UserBlockProps, Write, AdminService, ExamSeoForm, AdminAnnouncement, AdminResult, StaffActor

### Community 24 - "Config & Middleware"

Cohesion: 0.07
Nodes (40): NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (renamed from ANON_KEY, no fallback), @supabase/ssr, @supabase/supabase-js, zod, AdminScreenKey, AdminScreenProps, analyticsSessionReplay, authDisabled (+32 more)

### Community 25 - "About Photo Editors"

Cohesion: 0.10
Nodes (53): About photo warnings (not 4:3, smaller than 1200x900), AboutSectionEditor(), ClosingEditor(), FormOf, GrowthEditor(), HeaderEditor(), listPlaceholders(), MissionEditor() (+45 more)

### Community 26 - "llms.txt & Domain Types"

Cohesion: 0.06
Nodes (42): AboutCtaProps, CompareTableProps, ExamSwitcherProps, ExamPanelProps, FindYourExamProps, FormatsProps, RatingsTableProps, marketplaceShops() (+34 more)

### Community 27 - "Admin Types & Writes"

Cohesion: 0.07
Nodes (49): AboutSectionEditorProps, InstantSaveOptions, aboutSectionFormValues(), photo(), slots(), text(), isAboutEditor(), isAboutSection() (+41 more)

### Community 28 - "Admin DB Rows"

Cohesion: 0.07
Nodes (51): OwnerPlan, AnyRow, byKey(), Call, CATALOGUE, CATALOGUE_TABLES, changes(), createExam() (+43 more)

### Community 29 - "Admin Server Actions"

Cohesion: 0.06
Nodes (54): addExam, addExamSubject, createAboutPhotoUpload, createSitePageShareImageUpload, removeExam, removeExamSubject, saveAboutSection, saveAnnouncement (+46 more)

### Community 30 - "Sidebar UI Primitives"

Cohesion: 0.08
Nodes (47): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage(), BreadcrumbEllipsis(), BreadcrumbItem() (+39 more)

### Community 31 - "Exam Page Editors"

Cohesion: 0.10
Nodes (42): ConflictNotice(), ConflictNoticeProps, EditorSaveRow(), AddExamForm(), AddSubjectForm(), DeleteExam(), ExamManageActions, NEVER_SAVED (+34 more)

### Community 32 - "Review Editor"

Cohesion: 0.09
Nodes (44): DeleteReviewProps, EditReview(), EditReviewProps, FieldsForm, MARKETPLACE_OPTIONS, NEVER_SAVED, NewReview(), NewReviewProps (+36 more)

### Community 33 - "Reviews & FAQ Lists"

Cohesion: 0.09
Nodes (39): metadata, renderFaqsTab(), ReviewsPage(), ReviewsPageProps, SearchParams, { jar }, Params, renderPage() (+31 more)

### Community 34 - "Domain Glossary & ADRs"

Cohesion: 0.09
Nodes (51): CONTEXT.md domain glossary, Access Pass, Ace Your Course, Active Device, Admin, Auth Strategy, Best Score, Beta Tester (+43 more)

### Community 35 - "Legal Pages"

Cohesion: 0.09
Nodes (28): findDocuments, generateMetadata(), LegalPage(), LegalPageProps, LegalBody(), LegalBodyProps, withEmailLinks(), legalContainer (+20 more)

### Community 36 - "Catalogue DB Rows"

Cohesion: 0.07
Nodes (45): writeCatalogue(), MARKETPLACES, getExamByCode, getExamPage, getProductBySlug, getSitePage, getWebsiteSettings, listBestSellers (+37 more)

### Community 37 - "Admin Form Hook"

Cohesion: 0.08
Nodes (40): AdminTextField(), EditorSaveRowProps, COLOURS, LINES, SaveState(), SaveStateProps, SaveStatus, ContactEmailForm() (+32 more)

### Community 38 - "Storage & Reset Route"

Cohesion: 0.08
Nodes (33): SUPABASE_SECRET_KEY (server-only), server-only, { getStaff, restoreSampleData }, OWNER, post(), POST(), routeWithDatabase(), isDatabaseConfigured (+25 more)

### Community 39 - "README, CI & Seam ADRs"

Cohesion: 0.07
Nodes (44): Setup composite action (pnpm, Node 22.23.1, frozen lockfile), Dependabot config (weekly npm + GitHub Actions), Pull request template, CI workflow, CI job: database (pnpm test:db on local Supabase), CI job: dependency-review (fail on high severity), CI job: e2e-admin (sample data, 2 shards), CI job: e2e-admin-live (local Supabase, 3 shards) (+36 more)

### Community 40 - "App Layout & OG Images"

Cohesion: 0.08
Nodes (29): next, editSampleData(), { jar }, AppleIcon(), contentType, size, BRAND_COLORS, brandMark() (+21 more)

### Community 41 - "Catalogue Import Runner"

Cohesion: 0.09
Nodes (28): prettier, REPO, { values, positionals }, GeneratedCatalogue, HandMaintained, Outcome, REPO, publishPhotos() (+20 more)

### Community 42 - "Home Page Hero"

Cohesion: 0.10
Nodes (32): HomePage(), Authenticity(), Formats(), BADGES, FourSteps(), hrefOf(), links(), section() (+24 more)

### Community 43 - "Mock FAQs Store"

Cohesion: 0.10
Nodes (37): FieldsForm, NewFaqProps, faqSlugFor(), newFaqForm(), FAQ, BOOT, EDITOR, GCASH (+29 more)

### Community 44 - "Review & FAQ Actions"

Cohesion: 0.07
Nodes (39): addFaq, addReview, countReviewDelete, moveFaqInGroup, moveReviewOnHome, removeFaq, removeReview, saveFaq (+31 more)

### Community 45 - "Admin Product List"

Cohesion: 0.09
Nodes (33): ProductFlagSwitchProps, BADGES, linkCountColour(), NO_FILTERS, ProductList(), ProductListProps, ProductListRow(), ProductListRowProps (+25 more)

### Community 46 - "v1 Spec & Mockup Maps"

Cohesion: 0.08
Nodes (37): Digital access granted only via PayMongo purchase, admin grant, or Free preview, In-memory sample data with SAMPLE DATA header tag, Store link fallback (product link -> shop link -> hidden), Member App mockup BUILD-MAP, Consent gate (Terms + Privacy, version stored), MemberApp_v2 mockup (28 screen states), PayMongo hosted checkout + webhook confirmation (implied), Physical-to-digital link missing (open question) (+29 more)

### Community 47 - "Mock Products Store"

Cohesion: 0.11
Nodes (38): addCheProduct(), cut(), PRODUCT, slugify(), SlugOptions, uniqueSlug(), PHOTO_TO_GO_LIVE, productFlagsSchema (+30 more)

### Community 48 - "Paths & Exam Hero"

Cohesion: 0.12
Nodes (26): ExamPage(), ExamPageProps, findExam, generateMetadata(), isCanonical(), LegalIndexPage(), redirect, CompareTable() (+18 more)

### Community 49 - "Site Navigation"

Cohesion: 0.10
Nodes (25): BrandLogo(), ExamsMenu(), ExamsMenuProps, MENU_GRID, EXAMS, renderMenu(), MENU_GRID, MobileNav() (+17 more)

### Community 50 - "Retired Tenancy Specs"

Cohesion: 0.08
Nodes (33): Admin roles: Owner / Editor / Invited (7-day invite expiry), Add the first Owner to the staff list, Spec: Multi-tenant foundation (superseded), getActiveOrg / requireOrgRole / hasOrgRole / isPlatformSuperadmin, Membership, Org Role (owner/admin/member), Organization, Platform Role superadmin (+25 more)

### Community 51 - "Staff Guard"

Cohesion: 0.09
Nodes (28): resetSampleData(), signOut(), switchAccount(), DeniedPage(), DeniedPageProps, metadata, { jar }, renderDenied() (+20 more)

### Community 52 - "Spreadsheet Parsing"

Cohesion: 0.09
Nodes (36): FieldError, isoDate(), PESOS, pesosToCentavos(), pipeList(), rating(), readCsv(), Sheet (+28 more)

### Community 53 - "Admin Settings Page"

Cohesion: 0.09
Nodes (33): { jar }, SCREENS, addInvite, cancelStaffInvite, changeStaffMemberRole, removeStaffMember, renewStaffInvite, saveContactEmail (+25 more)

### Community 54 - "Catalogue Read Rules"

Cohesion: 0.10
Nodes (35): ascending(), bestSelling, by(), byTitle(), catalogueReads(), getExamByCode(), getExamPage(), getProductBySlug() (+27 more)

### Community 55 - "Identity & Sign-in Method"

Cohesion: 0.09
Nodes (30): Public /auth/v1/settings reader { google, email } (generalised googleEnabled), attemptFromUser(), AuthProviders, authProviders(), authSettingsSchema, GoogleSignInStart, NO_PROVIDERS, passwordSignInAllowed() (+22 more)

### Community 56 - "Admin Products Page"

Cohesion: 0.09
Nodes (32): addProduct, countProductDelete, createPhotoUpload, removeProduct, saveProduct, setProductFlag, IDLE, { jar } (+24 more)

### Community 57 - "Admin Sign-in Flow"

Cohesion: 0.09
Nodes (26): continueWithGoogle(), signInAs(), signInWithPassword(), form(), IDLE, { jar }, signInAs(), { auth, jar } (+18 more)

### Community 58 - "Product Panel & Delete"

Cohesion: 0.08
Nodes (28): actionsWith(), answering(), [FIRST = "", SECOND = ""], network, POSTERS, PREVIEW, renderPosters(), router (+20 more)

### Community 59 - "Hero Video & Carousels"

Cohesion: 0.10
Nodes (22): react, AdminTextFieldProps, RadioGroup(), RadioGroupItem(), Textarea(), FormulaCard(), FormulaCardProps, TryACard() (+14 more)

### Community 60 - "Mock Staff Store"

Cohesion: 0.13
Nodes (30): editSampleData(), AdminAccountsProps, roleRefusal(), importWithDatabaseUrl(), SignInResolution, StaffList, getOverview(), listExamsForAdmin() (+22 more)

### Community 61 - "Spreadsheet Build"

Cohesion: 0.08
Nodes (34): build(), locate(), byOrder(), columnOf(), convertSpreadsheet(), read(), ErrorLocation, EXAM_COLUMNS (+26 more)

### Community 62 - "Admin E2E Helpers"

Cohesion: 0.11
Nodes (22): BLOCKING_IMPACTS, KEYBOARD_SCREENS, SIZES, globalSetup(), E2E_PASSWORD, ensurePasswordUser(), localSupabaseAdmin(), sessionCookies() (+14 more)

### Community 63 - "Admin Shell & Sidebar"

Cohesion: 0.14
Nodes (27): AdminShellLayout(), AdminDrawer(), AdminDrawerProps, EDITOR, OWNER, renderDrawer(), signOut, adminMenu() (+19 more)

### Community 64 - "Runtime Dependencies"

Cohesion: 0.06
Nodes (33): dependencies, class-variance-authority@^0.7.1, clsx@^2.1.1, dayjs@^1.11.13, drizzle-orm@^0.45.2, @hookform/resolvers@^4.1.3, lucide-react@^0.469.0, next@^15.5.7 (+25 more)

### Community 65 - "Dev Dependencies"

Cohesion: 0.06
Nodes (32): devDependencies, @axe-core/playwright@^4.12.1, @commitlint/config-conventional@^19.8.0, csv-parse@^7.0.3, dotenv@^17.4.2, eslint@^9.23.0, eslint-config-next@^15.5.7, jsdom@^26.0.0 (+24 more)

### Community 66 - "Mock Exam Pages Store"

Cohesion: 0.19
Nodes (32): alreadyAnExam(), alreadyASubject(), examDeleteBlocker(), newExamCodeOf(), subjectDeleteBlocker(), ExamPagePart, addSubject(), adminExamPageOf() (+24 more)

### Community 67 - "Admin Sign-in Page"

Cohesion: 0.10
Nodes (23): SignInAsState, metadata, SignInPage(), SignInPageProps, { jar }, AuthScreen(), AuthScreenProps, GoogleSignInForm() (+15 more)

### Community 68 - "SEO Editors & Check"

Cohesion: 0.12
Nodes (25): EditorProps, UploadProps, SAVED, ExamPageActions, counterTone(), EXAM_SET_UP_AUTOMATICALLY, SeoEditorProps, SeoFields() (+17 more)

### Community 69 - "Admin Review List"

Cohesion: 0.12
Nodes (25): NO_FILTERS, ReviewList(), ReviewListProps, ReviewListRow(), ReviewListRowProps, STAR_CHIPS, ReviewSearch(), ReviewSearchProps (+17 more)

### Community 70 - "Mock Reviews Store"

Cohesion: 0.16
Nodes (28): reviewFormSchema, ReviewInput, ReviewMove, reviewMoveSchema, reviewPinSchema, adminReviewOf(), createReview(), deleteReview() (+20 more)

### Community 71 - "Product Form & Peso"

Cohesion: 0.08
Nodes (21): FieldsForm, groupedPesos, ParsedPeso, parsePeso(), pesoText(), figureText(), productFormValues(), productForm() (+13 more)

### Community 72 - "Promo & Announcement"

Cohesion: 0.11
Nodes (22): announcementFormValues(), BOOT, EDITOR, NEVER_SAVED, OWNER, SAVED_BY_EDITOR, SEED_BANNER, SEED_MESSAGES (+14 more)

### Community 73 - "Website E2E Specs"

Cohesion: 0.08
Nodes (7): cta(), expect, SECTION_IDS, expect, EXAMS, @playwright/test@^1.50.1, @playwright/test

### Community 74 - "Package Tooling"

Cohesion: 0.08
Nodes (25): author, @commitlint/cli@^19.8.0, husky@^9.1.7, lint-staged@^15.4.3, tsx@^4.23.15, tw-animate-css@^1.2.4, @types/node@^22.13.17, @vitejs/plugin-react@^4.3.4 (+17 more)

### Community 75 - "Dialog & Error UI"

Cohesion: 0.15
Nodes (18): lucide-react, ErrorState(), ErrorStateProps, Button(), buttonVariants, Card(), CardAction(), CardContent() (+10 more)

### Community 76 - "Admin Arms Tests"

Cohesion: 0.08
Nodes (14): BOOT, EDITOR, BOOT, EDITOR, NEVER_SAVED, OWNER, SAVED_BY_EDITOR, BOOT (+6 more)

### Community 77 - "Sitemap & SEO"

Cohesion: 0.14
Nodes (18): RFC-9309, robots(), dynamic, sitemap(), sitemapPaths(), getSiteURL(), buildRobots(), buildSitemap() (+10 more)

### Community 78 - "Import Photo Staging"

Cohesion: 0.15
Nodes (21): sharp@^0.35.5, sharp, Conversion, isFile(), isFileName(), isProductsPath(), optimise(), Optimised (+13 more)

### Community 79 - "npm Scripts"

Cohesion: 0.09
Nodes (23): scripts, build, catalogue:import, catalogue:seed, db:check, db:generate, db:reset, db:start (+15 more)

### Community 80 - "Staff E2E Spec"

Cohesion: 0.13
Nodes (16): openSignInAs(), signInAs(), signInWithEmail(), waitForHydration(), expect, openOverview(), accounts(), accountsStatus() (+8 more)

### Community 81 - "TypeScript Config"

Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+12 more)

### Community 82 - "Seam & Clean Arch Skills"

Cohesion: 0.13
Nodes (17): ADR 0003 Mock-First Service Seam, clean-architecture Skill, The Dependency Rule (dependencies point inward), DTOs at the Boundary (not raw rows), Refactoring in Small Green Steps (Kent Beck), Service Seam (src/services/*), CustomersTable Reference Pattern, ADR 0005 Multi-Tenancy (retired track) (+9 more)

### Community 83 - "Website Settings Admin"

Cohesion: 0.13
Nodes (15): PartProps, SettingsEditorProps, opened(), WebsiteSettingsUpdate, BOOT, EDITOR, expectNothingSaved(), OWNER (+7 more)

### Community 84 - "Product Photos E2E"

Cohesion: 0.17
Nodes (17): isUploadPut(), publicUrlOf(), uploadPathOf(), addPhotos(), editor(), expect, FIXTURE, fixtureAs() (+9 more)

### Community 85 - "FAQ Editor Tests"

Cohesion: 0.13
Nodes (13): actionsWith(), answering(), CARDS_REVIEW, editor(), opened(), POSTERS, POSTERS_REVIEW, renderEdit() (+5 more)

### Community 86 - "Drizzle & RLS Skills"

Cohesion: 0.16
Nodes (15): CatalogueService Contract, Dependency Inversion at the Seam, RLS Enabled on Every Exposed Table + Cross-User Denial Test, Database Tests (*.db.test.ts via TEST_DATABASE_URL), drizzle-data Skill, Lazy getDb() Client (no connection at import/build), Server-Only Secrets in src/env.server.ts (DATABASE_URL, SUPABASE_SECRET_KEY), import "server-only" Environment Isolation (+7 more)

### Community 87 - "shadcn Config"

Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 88 - "Sitewide A11y E2E"

Cohesion: 0.15
Nodes (12): BLOCKING_IMPACTS, NOT_FOUND, PUBLIC_PAGES, SHELL_PAGES, STATIC_PAGES, expect, isUnder(), pathOf() (+4 more)

### Community 89 - "Catalogue SQL Schema"

Cohesion: 0.16
Nodes (13): "announcement_messages", "exam_pages", "exams", "faqs", "product_listings", "product_photos", "product_subjects", "product_variations" (+5 more)

### Community 90 - "Next.js, CSP & PostHog Skills"

Cohesion: 0.15
Nodes (13): anime-js Skill (v4, install-on-demand), createScope().revert() Cleanup on Unmount, prefers-reduced-motion Guard, Next 15 Async Request APIs (await headers/cookies/params), Edge Middleware Nonce CSP (buildCsp), nextjs-app-router Skill (Next 15, React 19), ADR 0007 Analytics PostHog, Consent-Gated Capture (GDPR) (+5 more)

### Community 91 - "UI & Forms Skills"

Cohesion: 0.20
Nodes (16): data-tables Skill (TanStack Table v8), Headless TanStack Table Rendered with shadcn Table, Referentially Stable columns/data, forms-validation Skill (react-hook-form + zod), shadcn Form Primitives (Form, FormField, FormMessage), Convention Skill Format (When to use, Version, Core standards, In this template, Red flags, Sources), Project Convention Skills Index, cn() + cva + asChild Composition (+8 more)

### Community 92 - "Secrets & Env Guards"

Cohesion: 0.12
Nodes (10): filesContaining(), OLD_KEY_NAME, PUBLIC_SECRET, repoFiles(), SECRET_KEY_NAME, SKIPPED, CONNECTION_STRING, KEY_PATTERNS (+2 more)

### Community 93 - "Dropdown Menu UI"

Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 94 - "Website Shell Ticket"

Cohesion: 0.17
Nodes (9): Ticket 01: Branded Website shell and Exams menu, Announcement bar (rotating, dismissible), Peso-to-centavo price conversion, Ticket 13: Template cleanup, Catalogue seam as documented Reference Feature, Executer prompt: Ticket 01: Branded Website shell and Exams menu, CatalogueService interface (listExams, getExamByCode, getWebsiteSettings), formatPeso(centavos) (+1 more)

### Community 95 - "Mockup Data Script"

Cohesion: 0.15
Nodes (11): CONTACT, DIGITAL, EXAM_INFO, EXAMS, PENDING, peso(), PRODUCTS, raw (+3 more)

### Community 96 - "Promo E2E Spec"

Cohesion: 0.22
Nodes (10): bannerForm(), dayMonth(), editor(), expect, message(), MONTHS, openPromo(), saveBanner() (+2 more)

### Community 97 - "Chart UI"

Cohesion: 0.18
Nodes (14): recharts@^3.8.0, recharts, ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartStyle() (+6 more)

### Community 98 - "Form & Label UI"

Cohesion: 0.20
Nodes (12): radix-ui, FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue (+4 more)

### Community 99 - "FAQ Explorer"

Cohesion: 0.28
Nodes (13): Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger(), faqElementId(), FaqExplorer(), FaqExplorerProps, FaqItem() (+5 more)

### Community 100 - "Import Test Fixtures"

Cohesion: 0.21
Nodes (12): SheetName, COMING_SOON_PRODUCT, csv(), LIVE_PRODUCT, saveSpreadsheet(), HAND_MAINTAINED, productRow(), SheetRecords (+4 more)

### Community 101 - "Logger"

Cohesion: 0.21
Nodes (6): logger, createLogger(), Logger, LoggerOptions, LogLevel, LogLevelNumber

### Community 102 - "Product & Reviews Tickets"

Cohesion: 0.21
Nodes (12): Ticket 02: Product page, No rating or review structured data, Products filters reflected in the URL, Best sellers carousel (top 6 by units sold), Ticket 07: Reviews page, Reviews wall filters, sorts and URL state, Executer prompt: Ticket 02: Product page, getProductBySlug / listProducts / listReviews seam methods (+4 more)

### Community 103 - "Website Ticket Plan"

Cohesion: 0.25
Nodes (12): Ticket 10: Legal pages, Ticket 12: Catalogue spreadsheet template and seed converter, Executer prompt: Ticket 04: Exam pages, Executer prompt: Ticket 05: Home, top half, Executer prompt: Ticket 07: Reviews page, Executer prompt: Ticket 10: Legal pages, Executer prompt: Ticket 12: Catalogue spreadsheet template and seed converter, Executer prompt: Ticket 13: Template cleanup (+4 more)

### Community 104 - "Mission Tabs"

Cohesion: 0.29
Nodes (11): class-variance-authority, Badge(), badgeVariants, Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger() (+3 more)

### Community 105 - "E2E Server Env"

Cohesion: 0.16
Nodes (8): parseEnv(), parseServerEnv(), OLD_KEY_NAME, E2eServer, e2eServerEnv(), LIVE_VARIABLES, BLANKED, LOCAL

### Community 106 - "Coding Standards & Commits"

Cohesion: 0.21
Nodes (13): Handoff Prompt Sections (Goal, Context, Scope, Approach, Acceptance, Verification, Guardrails), /ship Command, /verify Command, Branch Off main, Never Commit to main, coding-standards 12-Category Checker, Coding Standards Spec (docs/superpowers/specs/2026-07-31-coding-standards.md), Conventional Commits, No any / no ! / no as-to-silence TypeScript Rules (+5 more)

### Community 107 - "Admin Journey E2E"

Cohesion: 0.19
Nodes (9): editor(), expect, saveState(), resetSampleData(), sampleEmail(), CARDS, expect, KIM (+1 more)

### Community 108 - "Announcement Bar"

Cohesion: 0.23
Nodes (9): AnnouncementBar(), dismiss(), AnnouncementBarProps, prefersReducedMotion(), readDismissedId(), readDismissedIdOnServer(), rememberDismissed(), subscribeToStorage() (+1 more)

### Community 109 - "Exam Pages Service Tests"

Cohesion: 0.15
Nodes (9): BOOT, EDITOR, NEVER_SAVED, OWNER, SAVED_BY_EDITOR, BundleOfferForm, ExamHeaderForm, productId (+1 more)

### Community 110 - "Settings E2E Spec"

Cohesion: 0.27
Nodes (10): contactPart(), expect, figuresPart(), linksPart(), MANILA_DATE, openSettings(), part(), saveContactEmail() (+2 more)

### Community 111 - "SEO Editor Tests"

Cohesion: 0.18
Nodes (9): DEFAULTS, faq(), network, renderEditor(), router, SAVED_AT, STAMP, Submission (+1 more)

### Community 112 - "Product Editor Tests"

Cohesion: 0.23
Nodes (8): actionsWith(), answering(), opened(), PREVIEW, renderEdit(), router, seedProduct(), Submission

### Community 113 - "Exam Schema Tests"

Cohesion: 0.21
Nodes (10): EXAMS_LIMIT, CHE, errors(), fieldErrorsOf(), NewExamForm, newSubjectFormSchema, passwordSignInSchema, errors() (+2 more)

### Community 114 - "Supabase Auth Skill"

Cohesion: 0.22
Nodes (8): Opt-In / Inert Analytics by Default (NEXT_PUBLIC_POSTHOG_KEY), ADR 0002 Auth Wired Directly to Supabase, Configured-or-Disabled Auth (dev bypass, prod fail-closed), Cookie Adapter get/set/remove Shape, Middleware Session Refresh on Session Routes, supabase-auth Skill, Three @supabase/ssr Client Contexts (browser, server, middleware), webServer with Placeholder Supabase Env

### Community 115 - "Password Sign-in Form"

Cohesion: 0.27
Nodes (9): Box heading 'TESTING ONLY' outside pnpm dev, PasswordSignInState, HEADINGS, IDLE, PasswordSignInForm(), PasswordSignInFormProps, Action, renderBox() (+1 more)

### Community 116 - "Products Page Tests"

Cohesion: 0.22
Nodes (7): grid(), gridNames(), loadPage(), PageModule, pages, renderPage(), SearchParams

### Community 117 - "Select UI"

Cohesion: 0.22
Nodes (7): SelectContent(), SelectItem(), SelectLabel(), SelectScrollDownButton(), SelectScrollUpButton(), SelectSeparator(), SelectTrigger()

### Community 118 - "Admin Action Tests"

Cohesion: 0.18
Nodes (8): adminAction(), EDITOR, IDLE, { jar }, OWNER, Saved, schema, STAMP

### Community 119 - "FAQ Page Ticket"

Cohesion: 0.24
Nodes (9): Catalogue seed validation, Ticket 08: FAQ page, FAQs in the Catalogue seam (5 fixed groups), FAQPage JSON-LD (visible FAQs only), FAQ Review quote must exist word for word in a seeded Review, validateCatalogueSeed(), Executer prompt: Ticket 08: FAQ page, faqPageJsonLd(groups) (+1 more)

### Community 121 - "FAQs E2E Spec"

Cohesion: 0.31
Nodes (8): editor(), expect, faqPageGroup(), FaqPageJsonLd, openFaqs(), questions(), row(), saveState()

### Community 122 - "Product Editor E2E"

Cohesion: 0.33
Nodes (9): CARDS, editor(), expect, field(), openEditor(), POSTERS, save(), saveState() (+1 more)

### Community 123 - "FAQ E2E Spec"

Cohesion: 0.22
Nodes (3): faq(), faqButton(), FaqPageJsonLd

### Community 124 - "Products E2E Spec"

Cohesion: 0.24
Nodes (4): card(), expect, grid(), gridNames()

### Community 125 - "Identity Live Tests"

Cohesion: 0.27
Nodes (6): { auth, jar }, claims(), identityIn(), identityWith(), loadIdentity(), signedInWith()

### Community 126 - "Exam Copy & Text"

Cohesion: 0.42
Nodes (6): examPageSeo(), examSeoDescription(), examSeoTitle(), formatList(), listFormat, truncate()

### Community 127 - "Row Diff"

Cohesion: 0.29
Nodes (7): AnyRow, diffRows(), keyed(), RowDiff, same(), Row, withNulls()

### Community 128 - "Fake Next Cache"

Cohesion: 0.31
Nodes (6): cachedTags(), clearFakeCache(), entries, Entry, fakeNextCache, Read

### Community 129 - "Claude Agent Config"

Cohesion: 0.33
Nodes (5): Project Subagents (empty, global agents), /handoff Command, RISEN Prompt Framework (role, steps, end product, constraints), `.claude/` Agent Configuration, settings.json (permission allowlist + hooks)

### Community 130 - "Exam Pages E2E"

Cohesion: 0.31
Nodes (6): editor(), expect, openExamPages(), saveState(), SHARE_IMAGE, SQUARE_IMAGE

### Community 131 - "Products List E2E"

Cohesion: 0.39
Nodes (6): count(), examChip(), expect, openProducts(), products(), row()

### Community 132 - "Admin Reviews E2E"

Cohesion: 0.33
Nodes (6): editor(), expect, openReviews(), pinSwitch(), row(), saveState()

### Community 133 - "Reviews E2E Spec"

Cohesion: 0.25
Nodes (3): cards(), expect, wall()

### Community 134 - "ESLint Config"

Cohesion: 0.22
Nodes (6): compat, __dirname, eslintConfig, __filename, @eslint/eslintrc@^3.3.1, @eslint/eslintrc

### Community 135 - "Subject Chips"

Cohesion: 0.31
Nodes (5): SubjectChips(), SubjectChipsProps, renderChips(), SUBJECTS, Subject

### Community 136 - "Admin Reviews Tests"

Cohesion: 0.22
Nodes (6): ALL_REVIEWS, BOOT, EDITOR, HOME_ORDER, LAZADA_REVIEW, OWNER

### Community 137 - "Site Pages E2E"

Cohesion: 0.29
Nodes (4): editor(), expect, saveState(), SHARE_IMAGE

### Community 138 - "PostHog Instrumentation"

Cohesion: 0.32
Nodes (5): posthog-js@^1.409.5, posthog-js, loadInstrumentation(), ADR-0009, ADR-0009

### Community 139 - "About Page Ticket"

Cohesion: 0.33
Nodes (7): marketplace_click analytics event, Store buttons (Listing, then shop page, else hidden), Ticket 09: About page, Computed About stats, trackMarketplaceClick(), Executer prompt: Ticket 09: About page, aboutStats({ productTotal, examCount, shopStats })

### Community 140 - "Products Page Ticket"

Cohesion: 0.33
Nodes (7): Coming Soon Product rules (no price, never P0, no buy buttons), Ticket 03: Products page, Help me choose picker, Computed Exam stats (Live Products only), Executer prompt: Ticket 03: Products page, recommendProduct(liveProducts, examCode, style), examStats(products)

### Community 141 - "Home Bottom Ticket"

Cohesion: 0.38
Nodes (7): Ticket 06: Home, bottom half, Which format fits how you study? format cards, Dated promo strip in Asia/Manila time, formatAsOf(isoDate) / manilaYear(now), Executer prompt: Ticket 06: Home, bottom half, formatCardStats(liveProducts, exams), isPromoActive(banner, now)

### Community 142 - "PostHog Handoff"

Cohesion: 0.43
Nodes (5): Handoff: PostHog analytics, instrumentation-client.ts PostHog init, Exclude /relay from middleware matcher, Privacy-first: identified_only, respect_dnt, consent-gated capture, Server helper captureServer + evaluateFlags (posthog-node)

### Community 144 - "Prettier Config"

Cohesion: 0.29
Nodes (6): plugins, printWidth, semi, singleQuote, tailwindStylesheet, trailingComma

### Community 145 - "Sitemap Ticket"

Cohesion: 0.47
Nodes (6): Ticket 11: Sitemap, robots, Organization data and site-wide checks, Organization JSON-LD with sameAs links, Sitemap and robots built from the Catalogue seam, Executer prompt: Ticket 11: Sitemap, robots, Organization data and site-wide checks, buildSitemap / buildRobots, organizationJsonLd(settings, siteUrl)

### Community 146 - "Add Exam E2E"

Cohesion: 0.40
Nodes (3): expect, productEditor(), productField()

### Community 147 - "Admin Header"

Cohesion: 0.47
Nodes (4): AdminHeader(), AdminHeaderProps, ResetSampleDataButton(), ResetSampleDataButtonProps

### Community 149 - "Admin SQL Schema"

Cohesion: 0.40
Nodes (5): "denied_sign_ins", denied_sign_ins_email_at_idx, "record_stamps", "staff", "staff_activity"

### Community 150 - "React 19 Reference"

Cohesion: 0.40
Nodes (5): <Context> as Provider, React 19 Reference, ref as a Prop (no forwardRef), useActionState, CustomerFormState

### Community 151 - "Home Top Ticket"

Cohesion: 0.40
Nodes (3): Ticket 05: Home, top half, Try a card flip widget, Site-wide checks (axe, 390px mobile, buying journey, no Member App leaks)

### Community 152 - "Exam Pages Ticket"

Cohesion: 0.40
Nodes (5): Ticket 04: Exam pages, CE bundle banner, Exam Review selection and display mode (marquee/grid/empty), Home Review selection (first 9 pinned), reviewDisplayMode(count)

### Community 154 - "Volta Toolchain"

Cohesion: 0.67
Nodes (3): volta, node, pnpm

## Ambiguous Edges - Review These

- `ADR 0005 Multi-Tenancy (retired track)` → `ADR 0008 Staff List, No Tenancy` [AMBIGUOUS]
  .claude/skills/drizzle-data/references/drizzle-rls.md · relation: conceptually_related_to
- `ADR 0009: Cookieless anonymous Website analytics, no consent banner` → `Opt-in / inert by default (isAnalyticsConfigured)` [AMBIGUOUS]
  docs/superpowers/handoffs/2026-07-31-posthog-analytics.md · relation: conceptually_related_to

## Knowledge Gaps

- **83 isolated node(s):** `ADR-0009`, `ADR-0009`, `RFC-9309`, `settings.json (permission allowlist + hooks)`, `RISEN Prompt Framework (role, steps, end product, constraints)` (+78 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1445 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `Website Component Tests` to `Reviews & Best Sellers UI`, `Upload Storage Seam`, `Site Footer & Promo Strip`, `DB Schema & Seed Tests`, `Admin Action Editors`, `Staff Accounts & Invites`, `Sample Store & Exam Pages`, `DB Check & Add Owner`, `Products Page Filters`, `Product Page & Cards`, `Admin Exam Pages View`, `Overview Needs Attention`, `Catalogue Service Reads`, `Admin Permission Tests`, `Catalogue Seed CLI`, `About Page Content`, `Catalogue Schema & Bucket`, `Config & Middleware`, `About Photo Editors`, `llms.txt & Domain Types`, `Admin Types & Writes`, `Admin DB Rows`, `Exam Page Editors`, `Review Editor`, `Reviews & FAQ Lists`, `Legal Pages`, `Catalogue DB Rows`, `Admin Form Hook`, `Storage & Reset Route`, `App Layout & OG Images`, `Catalogue Import Runner`, `Home Page Hero`, `Mock FAQs Store`, `Review & FAQ Actions`, `Admin Product List`, `Mock Products Store`, `Paths & Exam Hero`, `Site Navigation`, `Staff Guard`, `Spreadsheet Parsing`, `Admin Settings Page`, `Identity & Sign-in Method`, `Admin Products Page`, `Admin Sign-in Flow`, `Product Panel & Delete`, `Hero Video & Carousels`, `Mock Staff Store`, `Admin Shell & Sidebar`, `Dev Dependencies`, `Admin Sign-in Page`, `SEO Editors & Check`, `Admin Review List`, `Product Form & Peso`, `Promo & Announcement`, `Package Tooling`, `Admin Arms Tests`, `Sitemap & SEO`, `Import Photo Staging`, `Website Settings Admin`, `FAQ Editor Tests`, `Secrets & Env Guards`, `Import Test Fixtures`, `E2E Server Env`, `Announcement Bar`, `Exam Pages Service Tests`, `SEO Editor Tests`, `Product Editor Tests`, `Exam Schema Tests`, `Password Sign-in Form`, `Products Page Tests`, `Admin Action Tests`, `Identity Live Tests`, `Exam Copy & Text`, `Row Diff`, `Fake Next Cache`, `Subject Chips`, `Admin Reviews Tests`, `PostHog Instrumentation`?**
  _High betweenness centrality (0.204) - this node is a cross-community bridge._
- **What connects `ADR-0009`, `ADR-0009`, `RFC-9309` to the rest of the system?**
  _83 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Website Component Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.023982102908277406 - nodes in this community are weakly interconnected._
- **Why does `cn()` connect `Sidebar UI Primitives` to `Reviews & Best Sellers UI`, `Site Footer & Promo Strip`, `Admin Action Editors`, `Staff Accounts & Invites`, `Products Page Filters`, `Product Page & Cards`, `Admin Exam Pages View`, `Overview Needs Attention`, `Catalogue Service Reads`, `Product & FAQ Editors`, `About Page Content`, `About Photo Editors`, `Review Editor`, `Reviews & FAQ Lists`, `Legal Pages`, `Admin Form Hook`, `App Layout & OG Images`, `Home Page Hero`, `Admin Product List`, `Paths & Exam Hero`, `Site Navigation`, `Hero Video & Carousels`, `Admin Shell & Sidebar`, `Admin Sign-in Page`, `SEO Editors & Check`, `Admin Review List`, `Dialog & Error UI`, `Dropdown Menu UI`, `Chart UI`, `Form & Label UI`, `FAQ Explorer`, `Mission Tabs`, `Select UI`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Should `Reviews & Best Sellers UI` be split into smaller, more focused modules?**
  _Cohesion score 0.031662781662781664 - nodes in this community are weakly interconnected._

### Low-confidence Hints

_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `ADR 0005 Multi-Tenancy (retired track)` and `ADR 0008 Staff List, No Tenancy`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `ADR 0009: Cookieless anonymous Website analytics, no consent banner` and `Opt-in / inert by default (isAnalyticsConfigured)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
