# Graph Report - aceyourcourse (2026-11-17)

## Corpus Check

- 209 files · ~687,214 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 6544 nodes · 19043 edges · 216 communities (184 shown, 32 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 495 edges (avg confidence: 0.86)
- Token cost: 425,046 input · 0 output

## Community Hubs (Navigation)

- Admin Form Schemas
- Website Component Tests
- Product Page & Admin Toggles
- Admin Tickets & Conventions
- Member DB Rows & Rules
- Member App Gate & Tests
- Sample Store & Exam Pages
- Admin Prompts 01-12
- Upload Storage Seam
- Reviews & FAQ Lists
- Admin Switches & Toasts
- DB Schema & Seed Tests
- Catalogue Seed CLI
- DB Check & Add Owner
- Admin Editor Action Types
- Home Page Sections
- Member Sign-out & Consent
- Member Account & Exams
- Products Page Filters
- Reviews & Best Sellers UI
- Site Navigation
- Admin Service Contract
- Active Device Screens
- Admin Sign-in Method
- Member App Ticket Decisions
- Admin Prompts 13-25
- Admin Permission Tests
- Catalogue Service Reads
- Domain Glossary & ADRs
- Admin Password Sign-in
- Admin Settings Schemas
- Review Editor
- Member Library & Content
- Admin Form Fields & Save
- Admin DB Rows
- About Photo Editors
- Legal Pages
- Env, Headers & Seed Bucket
- Staff Accounts & Invites
- Config & Middleware
- Paths & Exam Hero
- Mock FAQs Store
- Mock Exam Pages Store
- Catalogue Schema & Bucket
- Product Editor Form
- Member Service Types
- Admin Action Editors
- Sidebar UI Primitives
- Access Check & Mock Content
- Catalogue DB Rows
- Admin Shell & Screens
- Exam Page Forms
- Staff Settings Actions
- llms.txt & Domain Types
- Admin A11y & E2E Helpers
- Member App E2E
- DB Schema & Seed Tests 2
- Catalogue & Content Tables
- Staff Guard
- Product Form & Peso
- Site Footer & Promo Strip
- Catalogue Read Rules
- FAQ Editor
- v1 Spec Seams & Surfaces
- Spreadsheet Parsing
- Review & FAQ Actions
- Admin Form Hook
- Retired Tenancy Specs
- Sample Data Reset Route
- Prompt 01 Shell & Beta Gate
- Mock Topics & Testers
- About Hero & Subject Chips
- Runtime Dependencies
- Catalogue Import Runner
- Admin Products Page
- Spreadsheet Build
- Prompts 11-17 Quiz & Access
- ADR 0010 Access Model
- Mock Products Store
- Prompt 06 Card Import
- Dev Dependencies
- Site Page SEO Editor
- Admin Product List
- Prompt 12 Reviewer PDF Job
- Dropdown Menu UI
- README, CI & Seam ADRs
- Website E2E Specs
- Admin Types & Writes
- Member App Grilling Decisions
- Package Tooling
- FAQ Explorer
- About Page Content
- Import Photo Staging
- Prompt 16 Users & Members
- npm Scripts
- shadcn UI Primitives
- Beta Gate & Legal Draft
- Target Exams Screen
- TypeScript Config
- Seam & Clean Arch Skills
- Config & Middleware 2
- Admin Exam Pages View
- Overview Needs Attention
- Product Photos E2E
- Overview Needs Attention 2
- Drizzle & RLS Skills
- shadcn Config
- Sitewide A11y E2E
- Site Pages E2E
- Product Panel & Delete
- Import Test Fixtures
- Next.js, CSP & PostHog Skills
- UI & Forms Skills
- Sitemap & SEO
- Secrets & Env Guards
- App Layout & OG Images
- App Layout & OG Images 2
- Admin Exam Pages View 2
- CI Workflow Config
- Admin Exam Pages View 3
- Reviews & Best Sellers UI 2
- Beta Testers Admin
- Admin Types & Writes 2
- Website Shell Ticket
- Mockup Data Script
- Promo E2E Spec
- Product & Reviews Tickets
- Website Ticket Plan
- CI Job Steps
- Member Coming Soon Pages
- About Page Content 2
- Form & Label UI
- Coding Standards & Commits
- CI Dependency Review
- Chart UI
- Announcement Bar
- Catalogue Service Reads 2
- Settings E2E Spec
- Staff E2E Spec
- Staff Accounts & Invites 2
- Dialog & Error UI
- Mission Tabs
- Admin Arms Tests
- Supabase Auth Skill
- Prompt 05 Content Model
- Row Diff
- Products Page Tests
- Admin Shell & Sidebar
- Select UI
- FAQ Page Ticket
- Mockup Unbundle Tool
- FAQs E2E Spec
- Product Editor E2E
- FAQ E2E Spec
- Products E2E Spec
- Identity Live Tests
- SEO Editors & Check
- Admin Reviews Tests
- Claude Agent Config
- Reviewer PDF Job Design
- Exam Pages E2E
- Products List E2E
- Admin Reviews E2E
- Reviews E2E Spec
- ESLint Config
- CI E2E Admin Matrix
- Admin Permission Tests 2
- About Page Content 3
- Beta Testers E2E
- CI Database Job
- PostHog Instrumentation
- Member Shell Tests
- About Page Ticket
- Products Page Ticket
- Home Bottom Ticket
- Exam E2E Spec
- Prettier Config
- Admin Exam Pages View 4
- Logger
- Exam Schema Tests
- Sitemap Ticket
- Fake Upload Request
- Admin SQL Schema
- React 19 Reference
- Home Top Ticket
- Exam Pages Ticket
- Website Component Tests 2
- CI Live E2E Job
- Spec Admin Page Editors
- Drizzle Kit
- Dev Dependencies 2
- Volta Toolchain
- Issue Templates
- CodeQL Workflow
- PostCSS Config
- Site Pages SQL
- v1 Spec & Mockup Maps
- Spec Admin Overview
- v1 Spec & Mockup Maps 2
- Spec Paths Module
- Spec Design Tokens
- v1 Spec & Mockup Maps 3
- v1 Spec & Mockup Maps 4
- v1 Spec & Mockup Maps 5
- v1 Spec & Mockup Maps 6
- Spec Supabase Keys

## God Nodes (most connected - your core abstractions)

1. `cn()` - 285 edges
2. `vitest` - 281 edges
3. `next` - 152 edges
4. `getSampleStore()` - 150 edges
5. `react` - 119 edges
6. `paths` - 118 edges
7. `StaffActor` - 109 edges
8. `@testing-library/react` - 98 edges
9. `AdminAction` - 79 edges
10. `Phase 2 (Admin) shared conventions` - 73 edges

## Surprising Connections (you probably didn't know these)

- `About photo warnings (not 4:3, smaller than 1200x900)` --semantically_similar_to--> `shareImageWarning()` [INFERRED] [semantically similar]
  .scratch/ayc-admin/prompts/21-about-page-editor.md → src/lib/admin/exam-pages-view.ts
- `ADR 0012: Host on Vercel Pro and Supabase Pro in Singapore` --references--> `docker-compose standalone self-host` [INFERRED]
  docs/adr/0012-vercel-and-supabase-singapore.md → docker-compose.yml
- `Site page (Home, Products, Reviews, About, FAQ)` --references--> `validateCatalogueSeed()` [INFERRED]
  .scratch/ayc-admin/prompts/20-site-page-seo.md → src/services/catalogue.schema.ts
- `CI job: e2e-admin-live (local Supabase, 3 shards)` --references--> `Staff Guard (verified email via getUser, amr claim)` [INFERRED]
  .github/workflows/ci.yml → README.md
- `Member App gate (pure function + server wrapper)` --semantically_similar_to--> `Staff Guard` [INFERRED] [semantically similar]
  .scratch/ayc-member-app/prompts/01-member-app-shell-and-beta-gate.md → docs/specs/2026-10-29-ayc-v1.md

## Import Cycles

- None detected.

## Hyperedges (group relationships)

- **Shared Admin save path (Guard, adminAction, conflict check, Staff Activity, cache tags)** — _scratch_ayc_admin_prompts_01_admin_shell_and_sign_in_staff_guard, _scratch_ayc_admin_prompts_02_settings_and_save_path_admin_action, _scratch_ayc_admin_prompts_02_settings_and_save_path_conflict_check, _scratch_ayc_admin_prompts_02_settings_and_save_path_staff_activity, _scratch_ayc_admin_prompts_02_settings_and_save_path_catalogue_cache_tags, _scratch_ayc_admin_prompts_02_settings_and_save_path_save_state_line [EXTRACTED 1.00]
- **Staff sign-in decision flow** — _scratch_ayc_admin_prompts_01_admin_shell_and_sign_in_staff_guard, _scratch_ayc_admin_prompts_01_admin_shell_and_sign_in_invite_activation, _scratch_ayc_admin_prompts_01_admin_shell_and_sign_in_denied_403_screen, _scratch_ayc_admin_prompts_01_admin_shell_and_sign_in_denied_sign_in_record, _scratch_ayc_admin_prompts_01_admin_shell_and_sign_in_safe_next, _scratch_ayc_admin_prompts_01_admin_shell_and_sign_in_admin_closed_in_production [EXTRACTED 1.00]
- **Admin write flow: action -> Guard -> seam -> conflict -> Staff Activity -> cache tags** — _scratch_ayc_admin_conventions_adminaction, _scratch_ayc_admin_conventions_staff_guard, _scratch_ayc_admin_conventions_admin_seam, _scratch_ayc_admin_conventions_conflict_check, _scratch_ayc_admin_conventions_staff_activity, _scratch_ayc_admin_conventions_cache_tags [EXTRACTED 1.00]
- **CI parallel jobs sharing the setup action** — _github_workflows_ci_verify, _github_workflows_ci_database, _github_workflows_ci_e2e_website, _github_workflows_ci_e2e_admin, _github_workflows_ci_e2e_admin_live, _github_workflows_ci_dependency_review, _github_actions_setup_action [EXTRACTED 1.00]
- **Features gated by the Member App switch** — _scratch_ayc_website_issues_01_branded_website_shell_member_app_switch, _scratch_ayc_website_issues_03_products_page_help_me_choose_picker, _scratch_ayc_website_issues_08_faq_page_faq_seam, _scratch_ayc_website_issues_11_sitemap_and_site_checks_sitewide_checks, _scratch_ayc_website_issues_05_home_top_half, _scratch_ayc_website_issues_02_product_page [EXTRACTED 1.00]
- **Planning to Executer Handoff Workflow** — _claude_readme_planning_executer_model, _claude_readme_prompt_architect_standing_rule, _claude_commands_handoff_handoff_command, _claude_commands_handoff_risen_framework, _claude_commands_handoff_handoff_prompt_sections [EXTRACTED 1.00]
- **/relay path kept in sync across rewrites, client api_host and middleware matcher** — docs_superpowers_handoffs_2026_07_31_posthog_analytics_relay_reverse_proxy, docs_superpowers_handoffs_2026_07_31_posthog_analytics_instrumentation_client, docs_superpowers_handoffs_2026_07_31_posthog_analytics_middleware_matcher_exclusion [EXTRACTED 1.00]
- **Stage B: Admin moves from sample data to Supabase (tickets 13-18)** — _scratch_ayc_admin_prompts_13_local_supabase_foundation, _scratch_ayc_admin_prompts_14_catalogue_on_the_database, _scratch_ayc_admin_prompts_15_admin_writes_on_the_database, _scratch_ayc_admin_prompts_16_real_staff_sign_in, _scratch_ayc_admin_prompts_17_photo_storage, _scratch_ayc_admin_prompts_18_production_go_live [EXTRACTED 1.00]
- **Stage B database rollout (tickets 13-18)** — _scratch_ayc_admin_issues_13_local_supabase_foundation, _scratch_ayc_admin_issues_14_catalogue_on_the_database, _scratch_ayc_admin_issues_15_admin_writes_on_the_database, _scratch_ayc_admin_issues_16_real_staff_sign_in, _scratch_ayc_admin_issues_17_photo_storage, _scratch_ayc_admin_issues_18_production_go_live [EXTRACTED 1.00]
- **Website pages consuming the Catalogue Service Seam and Product/Review contract** — _scratch_ayc_website_issues_01_branded_website_shell_catalogue_service_seam, _scratch_ayc_website_issues_02_product_page_product_review_read_contract, _scratch_ayc_website_issues_03_products_page, _scratch_ayc_website_issues_04_exam_pages, _scratch_ayc_website_issues_05_home_top_half, _scratch_ayc_website_issues_07_reviews_page, _scratch_ayc_website_issues_09_about_page, _scratch_ayc_website_issues_11_sitemap_and_site_checks [INFERRED 0.85]
- **FAQ quote integrity across Reviews, FAQs and Product delete** — _scratch_ayc_admin_prompts_07_reviews_faq_quote_guard, _scratch_ayc_admin_prompts_08_faqs_faq_quote_picker, _scratch_ayc_admin_prompts_05_product_editor_product_delete_cascade, src_services_catalogue_schema [INFERRED 0.85]
- **Milestone 2 self-editable content (Site page SEO, About editor, llms.txt, add Exams)** — _scratch_ayc_admin_prompts_20_site_page_seo_contract_milestone_2, _scratch_ayc_admin_prompts_20_site_page_seo_site_page, _scratch_ayc_admin_prompts_21_about_page_editor_about_page_editor, src_app_llms_txt_route, _scratch_ayc_admin_prompts_23_add_exams_and_subjects_add_exam_owner_only [INFERRED 0.85]
- **Mock-first data architecture behind the Service Seam** — context_service_seam, docs_adr_0003_mock_first_service_seam, docs_adr_0006_drizzle_data_layer, docs_adr_0006_drizzle_data_layer_mock_db_selector, docs_adr_0006_drizzle_data_layer_lazy_db_client, docs_adr_0004_rsc_server_actions_first_rsc_reads_server_action_writes, context_reference_feature [INFERRED 0.85]
- **Nonce CSP Defense-in-Depth** — _claude_skills_coding_standards_skill_strict_nonce_csp, _claude_skills_nextjs_app_router_skill_csp_middleware, _claude_skills_nextjs_app_router_skill_dynamic_root_layout, _claude_skills_posthog_skill_session_replay_worker_src, _claude_skills_posthog_skill_relay_reverse_proxy [INFERRED 0.85]
- **Server Action Security Flow (re-auth, authz, validate, seam)** — _claude_skills_coding_standards_skill_in_action_authz, _claude_skills_forms_validation_skill_two_boundary_validation, _claude_skills_nextjs_app_router_references_server_actions_server_action_write_pattern, _claude_skills_supabase_auth_skill_getuser_not_getsession, _claude_skills_supabase_auth_skill_staff_list_authorization [INFERRED 0.85]
- **Staff sign-in method evolution (sample list, Google OAuth, dev password, temporary prod password)** — _scratch_ayc_admin_issues_01_admin_shell_and_sign_in, _scratch_ayc_admin_issues_16_real_staff_sign_in_live_mode_google_oauth, _scratch_ayc_admin_issues_19_development_password_sign_in_dev_password_box, _scratch_ayc_admin_issues_24_password_sign_in_in_production_admin_password_sign_in_switch, _scratch_ayc_admin_conventions_identity_amr_rule [INFERRED 0.85]
- **Staff sign-in method policy (live mode, amr rule, dev box, production switch)** — _scratch_ayc_admin_prompts_16_real_staff_sign_in_live_mode, _scratch_ayc_admin_prompts_19_development_password_sign_in_amr_method_rule, _scratch_ayc_admin_prompts_19_development_password_sign_in_development_password_sign_in, _scratch_ayc_admin_prompts_24_password_sign_in_in_production_admin_password_sign_in_switch, src_lib_admin_sign_in_method, _scratch_ayc_admin_prompts_24_password_sign_in_in_production_pure_password_decision [INFERRED 0.85]
- **Website structured data builders (no rating/review markup)** — _scratch_ayc_website_issues_02_product_page_no_rating_review_markup, _scratch_ayc_website_prompts_02_product_page_productjsonld, _scratch_ayc_website_prompts_08_faq_page_faqpagejsonld, _scratch_ayc_website_prompts_11_sitemap_and_site_checks_organizationjsonld, _scratch_ayc_website_issues_11_sitemap_and_site_checks_organization_json_ld, _scratch_ayc_website_issues_08_faq_page_faqpage_json_ld [INFERRED 0.85]
- **Member App access decision inputs** — docs_specs_2026_10_29_ayc_v1_access_decision_seam, docs_specs_2026_10_29_ayc_v1_active_device, docs_specs_2026_10_29_ayc_v1_beta_gate, docs_adr_0010_access_follows_the_exam_free_preview, docs_adr_0010_access_follows_the_exam_access_pass, context_course_ownership, docs_adr_0010_access_follows_the_exam_staff_access_amendment [EXTRACTED 1.00]
- **Admin Staff save flow** — graphify_out_memory_query_20261116_171558_40afcb46_how_does_one_staff_save_travel_from_an_admin_edito_calladminaction, graphify_out_memory_query_20261116_171558_40afcb46_how_does_one_staff_save_travel_from_an_admin_edito_adminaction, graphify_out_memory_query_20261116_171558_40afcb46_how_does_one_staff_save_travel_from_an_admin_edito_requirestaff, graphify_out_memory_query_20261116_171558_40afcb46_how_does_one_staff_save_travel_from_an_admin_edito_stampedwrite, graphify_out_memory_query_20261116_171558_40afcb46_how_does_one_staff_save_travel_from_an_admin_edito_ondatabase, graphify_out_memory_query_20261116_171558_40afcb46_how_does_one_staff_save_travel_from_an_admin_edito_record_stamps [EXTRACTED 1.00]
- **Admin seam write contract** — docs_specs_2026_10_29_ayc_v1_admin_seam, docs_specs_2026_10_29_ayc_v1_staff_guard, docs_specs_2026_10_29_ayc_v1_conflict_check, docs_specs_2026_10_29_ayc_v1_staff_activity, docs_specs_2026_10_29_ayc_v1_rendering_and_caching [EXTRACTED 1.00]
- **Protected reads gated by the Access Decision** — _scratch_ayc_member_app_issues_05_content_model_topics_library_access_access_decision, _scratch_ayc_member_app_issues_08_flashcard_study_deck_player, _scratch_ayc_member_app_issues_11_quiz_taking_quiz_player, _scratch_ayc_member_app_issues_14_reviewer_pdf_reader_protected_page_endpoint, _scratch_ayc_member_app_issues_05_content_model_topics_library_access_library [EXTRACTED 1.00]
- **Current-state progress records feeding the progress calculator** — context_card_mark, _scratch_ayc_member_app_grilling_notes_quiz_attempt, context_study_day, _scratch_ayc_member_app_issues_15_dashboard_and_progress_progress_calculator, _scratch_ayc_member_app_grilling_notes_current_state_progress [EXTRACTED 1.00]
- **Privacy Request flow (Member request to Owner fulfilment)** — _scratch_ayc_member_app_issues_18_account_support_privacy_requests_data_copy_request, _scratch_ayc_member_app_issues_18_account_support_privacy_requests_deletion_request, _scratch_ayc_member_app_issues_18_account_support_privacy_requests_privacy_requests_admin_list, _scratch_ayc_member_app_issues_19_privacy_request_fulfilment_member_data_export, _scratch_ayc_member_app_issues_19_privacy_request_fulfilment_delete_account, _scratch_ayc_member_app_issues_19_privacy_request_fulfilment_mark_request_done [INFERRED 0.95]
- **Member App server check chain (gate, consent, Active Device, access decision)** — _scratch_ayc_member_app_prompts_01_member_app_shell_and_beta_gate_member_app_gate, _scratch_ayc_member_app_prompts_02_consent_and_legal_v2_draft_consent_check, _scratch_ayc_member_app_prompts_04_active_device_devicestatus, _scratch_ayc_member_app_prompts_05_content_model_topics_library_access_access_decision [EXTRACTED 1.00]
- **Admin content authoring (imports and editors sharing formula, bucket, conflict check)** — _scratch_ayc_member_app_prompts_06_card_import_card_import_planner, _scratch_ayc_member_app_prompts_09_quiz_import_and_settings_quiz_import, _scratch_ayc_member_app_prompts_07_card_editor_card_editor, _scratch_ayc_member_app_prompts_10_question_editor_question_editor, _scratch_ayc_member_app_prompts_06_card_import_formula_module, _scratch_ayc_member_app_prompts_06_card_import_conflict_check [INFERRED 0.85]
- **Corrections never cost progress** — _scratch_ayc_member_app_prompts_06_card_import_replace_vs_add, _scratch_ayc_member_app_prompts_08_flashcard_study_card_mark, _scratch_ayc_member_app_prompts_09_quiz_import_and_settings_removed_question_marker, _scratch_ayc_member_app_prompts_09_quiz_import_and_settings_best_score [INFERRED 0.85]
- **Phase 3 Member App executer prompt series (tickets 11-19)** — _scratch_ayc_member_app_prompts_11_quiz_taking_executer_prompt, _scratch_ayc_member_app_prompts_12_reviewer_pdf_upload_and_job_executer_prompt, _scratch_ayc_member_app_prompts_13_reviewer_pdf_placement_and_publishing_executer_prompt, _scratch_ayc_member_app_prompts_14_reviewer_pdf_reader_executer_prompt, _scratch_ayc_member_app_prompts_15_dashboard_and_progress_executer_prompt, _scratch_ayc_member_app_prompts_16_users_and_member_detail_executer_prompt, _scratch_ayc_member_app_prompts_17_grant_extend_end_access_executer_prompt, _scratch_ayc_member_app_prompts_18_account_support_privacy_requests_executer_prompt, _scratch_ayc_member_app_prompts_19_privacy_request_fulfilment_executer_prompt [INFERRED 0.95]
- **Reviewer PDF pipeline: upload, process, publish, stamp and read** — _scratch_ayc_member_app_prompts_12_reviewer_pdf_upload_and_job_tus_resumable_upload, _scratch_ayc_member_app_prompts_12_reviewer_pdf_upload_and_job_reviewer_pdf_job_state_machine, _scratch_ayc_member_app_prompts_13_reviewer_pdf_placement_and_publishing_reviewer_pdf_status_rules, _scratch_ayc_member_app_prompts_14_reviewer_pdf_reader_protected_page_endpoint, _scratch_ayc_member_app_prompts_14_reviewer_pdf_reader_watermark_stamper, _scratch_ayc_member_app_prompts_14_reviewer_pdf_reader_reader_screen [INFERRED 0.85]
- **Current-state progress records feeding the progress calculator** — _scratch_ayc_member_app_prompts_11_quiz_taking_quiz_attempt, _scratch_ayc_member_app_prompts_14_reviewer_pdf_reader_pages_viewed_record, _scratch_ayc_member_app_prompts_11_quiz_taking_study_day, _scratch_ayc_member_app_prompts_14_reviewer_pdf_reader_reviewer_resume_state, _scratch_ayc_member_app_prompts_15_dashboard_and_progress_progress_calculator, _scratch_ayc_member_app_prompts_15_dashboard_and_progress_member_progress_summary [INFERRED 0.85]

## Communities (216 total, 32 thin omitted)

### Community 0 - "Admin Form Schemas"

Cohesion: 0.02
Nodes (155): cePage(), addTopic, moveTopicInSubject, removeTopic, saveTopicName, addExam, addExamSubject, createAboutPhotoUpload (+147 more)

### Community 1 - "Website Component Tests"

Cohesion: 0.03
Nodes (90): @testing-library/react, @testing-library/user-event, cards, headers(), posters, rows(), soonNotebook, table() (+82 more)

### Community 2 - "Product Page & Admin Toggles"

Cohesion: 0.05
Nodes (79): findProduct, ProductPage(), ProductPageProps, EDITOR, postersOnTheWebsite(), Variations(), RadioGroup(), RadioGroupItem() (+71 more)

### Community 3 - "Admin Tickets & Conventions"

Cohesion: 0.04
Nodes (91): Phase 2 (Admin) shared conventions, Admin mockup look (AdminDashboard_v2, Website tokens, light-only), Admin seam (src/services/admin.ts) write contract, adminAction helper (Guard, zod, seam, revalidateTag), AdminResult / AdminError / StaffActor types, paths.admin route table (src/paths.ts), Playwright admin project (e2e/admin, workers 1, resetSampleData, signInAs), Staff Activity record (before/after per entity changed) (+83 more)

### Community 4 - "Member DB Rows & Rules"

Cohesion: 0.04
Nodes (99): deviceStatusFor(), TOKEN_HASH_PATTERN, staffEmailSchema, accessPassFromRow(), AccessPassRow, contentFromRows(), ContentRows, DeckRow (+91 more)

### Community 5 - "Member App Gate & Tests"

Cohesion: 0.03
Nodes (82): AFTER_CONSENT, agreedTester(), APP_DIR, ENTRIES, Entry, GATED, { jar, mode }, MEMBER_ONLY (+74 more)

### Community 6 - "Sample Store & Exam Pages"

Cohesion: 0.04
Nodes (62): editSampleData(), { jar }, { jar }, renderDenied(), fixCpaSearch(), { jar }, NOW, reads (+54 more)

### Community 7 - "Admin Prompts 01-12"

Cohesion: 0.04
Nodes (81): Executer prompt 01: Admin shell and Staff sign-in, Admin seam (src/services/admin.ts, admin.types, admin.mock), Admin shell: sidebar, header with SAMPLE DATA tag, user block, mobile drawer, 403 denied screen with logged attempt, Denied sign-in attempt recording (recordDeniedSignIn), Invite activation on first sign-in (resolveSignIn), Manila-time greeting and date line, safe-next redirect accepting /admin paths only (+73 more)

### Community 8 - "Upload Storage Seam"

Cohesion: 0.04
Nodes (69): Storage path site-pages/{page}/share-{uuid}.{ext}, ANSWERS, GET(), notFound(), PUT(), RouteContext, context(), EDITOR (+61 more)

### Community 9 - "Reviews & FAQ Lists"

Cohesion: 0.05
Nodes (67): countReviewDelete, metadata, renderFaqsTab(), ReviewsPage(), ReviewsPageProps, SearchParams, { jar }, Params (+59 more)

### Community 10 - "Admin Switches & Toasts"

Cohesion: 0.05
Nodes (65): react, sonner, AdminSwitch(), AdminSwitchProps, IDLE, REDIRECT, State, nameError() (+57 more)

### Community 11 - "DB Schema & Seed Tests"

Cohesion: 0.05
Nodes (47): pnpm test:db (*.db.test.ts, node env), drizzle-orm, postgres, vitest, getDb(), CONNECT_TIMEOUT_SECONDS, ConnectOptions, Database (+39 more)

### Community 12 - "Catalogue Seed CLI"

Cohesion: 0.05
Nodes (60): staff and denied_sign_ins tables, globalSetup(), dryRun(), HINTS, runCatalogueSeed(), SeedCommand, seedProblems(), storagePhotos() (+52 more)

### Community 13 - "DB Check & Add Owner"

Cohesion: 0.05
Nodes (60): One-time signed upload URL (createSignedUploadUrl), dotenv, addOwner(), AddOwnerCommand, AddOwnerOutcome, addOwner(), DEPLOYMENT_ACTOR, OwnerPlan (+52 more)

### Community 14 - "Admin Editor Action Types"

Cohesion: 0.04
Nodes (59): addTester, removeTester, TopicsEditorActions, TopicsEditorProps, DeleteProductProps, EditProductProps, ProductEditorActions, ProductFlagSwitchProps (+51 more)

### Community 15 - "Home Page Sections"

Cohesion: 0.06
Nodes (49): HomePage(), Authenticity(), BestSellersCarousel(), BestSellersCarouselProps, Formats(), BADGES, FourSteps(), hrefOf() (+41 more)

### Community 16 - "Member Sign-out & Consent"

Cohesion: 0.05
Nodes (57): signOut(), agreeAndContinue(), ConsentFormState, agree(), BOOT, BOTH, consentPage(), consents() (+49 more)

### Community 17 - "Member Account & Exams"

Cohesion: 0.07
Nodes (62): AccountPage(), metadata, addExam(), changeExamDate(), ExamDateState, ExamFormState, redrawShell(), removeExam() (+54 more)

### Community 18 - "Products Page Filters"

Cohesion: 0.06
Nodes (56): examList, ProductsPage(), ProductsPageProps, CountNoun, FilterChip(), FilterChipGroup(), FilterChipProps, renderGroup() (+48 more)

### Community 19 - "Reviews & Best Sellers UI"

Cohesion: 0.05
Nodes (53): HeroFigure(), HeroLabel(), ReviewsPage(), ReviewsPageProps, ExamReviews(), ExamReviewsProps, tilt(), TILTS (+45 more)

### Community 20 - "Site Navigation"

Cohesion: 0.06
Nodes (45): next, metadata, NotOpenYetPage(), LegalIndexPage(), redirect, TABS, UsersTab, ExamSwitcher() (+37 more)

### Community 21 - "Admin Service Contract"

Cohesion: 0.07
Nodes (15): FieldsForm, ROLE_LABEL, UserBlockProps, BetaTestersActions, Write, AdminService, FaqForm, AdminAbout (+7 more)

### Community 22 - "Active Device Screens"

Cohesion: 0.05
Nodes (62): confirmThisDevice(), signInOnThisDevice(), DevicePage(), DevicePageProps, generateMetadata(), adminSignInAs(), Browser, browser() (+54 more)

### Community 23 - "Admin Sign-in Method"

Cohesion: 0.06
Nodes (58): Public /auth/v1/settings reader { google, email } (generalised googleEnabled), zod, continueWithGoogle(), signInAs(), metadata, SELLING_POINTS, SignInPage(), SignInPageProps (+50 more)

### Community 24 - "Member App Ticket Decisions"

Cohesion: 0.06
Nodes (60): ADR 0010 (with Staff access amendment), Device Token Cookie (random, httpOnly, hashed), Onboarding (Start my countdown), Ticket 03: Onboarding and Target Exams, ADR 0011, Active Device Seam Function (active / no-token / replaced), Session Ended Screen, Ticket 04: Active Device (+52 more)

### Community 25 - "Admin Prompts 13-25"

Cohesion: 0.07
Nodes (49): Executer prompt 13: Local Supabase foundation, Executer prompt 14: Catalogue on the database, catalogue:seed --production refuses when data exists, Equivalence test: every Website query deep-equals across both arms, Executer prompt 15: Admin writes on the database, POST /api/dev/sample-data/reset re-seeds only a local database, Staff Activity record (staff_activity table), Write + Staff Activity in one transaction; failure rolls back everything (+41 more)

### Community 26 - "Admin Permission Tests"

Cohesion: 0.04
Nodes (53): ADMIN_DIR, EDITOR, EDITOR_SAVES, editorSave(), ENTRIES, Entry, GUARDED, IDLE (+45 more)

### Community 27 - "Catalogue Service Reads"

Cohesion: 0.07
Nodes (50): dynamic, GET(), PLAIN_TEXT, summary(), dynamic, sitemap(), generateMetadata(), addCheProduct() (+42 more)

### Community 28 - "Domain Glossary & ADRs"

Cohesion: 0.07
Nodes (64): drizzle-kit writes migrations into supabase/migrations with Supabase prefixes, CONTEXT.md domain glossary, Access Pass, Ace Your Course, Active Device, Admin, Auth Strategy, Best Score (+56 more)

### Community 29 - "Admin Password Sign-in"

Cohesion: 0.06
Nodes (45): Box heading 'TESTING ONLY' outside pnpm dev, switchAccount(), continueWithGoogle(), PasswordSignInState, signInAs(), SignInAsState, signInWithPassword(), form() (+37 more)

### Community 30 - "Admin Settings Schemas"

Cohesion: 0.07
Nodes (56): promoBannerVisibleSchema, reviewFormSchema, ReviewInput, reviewMoveSchema, reviewPinSchema, WebsiteSettingsUpdate, BOOT, EDITOR (+48 more)

### Community 31 - "Review Editor"

Cohesion: 0.07
Nodes (50): ConflictNoticeProps, renderButtons(), renderSwitch(), REVIEW, router, Submission, DeleteReviewProps, EditReview() (+42 more)

### Community 32 - "Member Library & Content"

Cohesion: 0.06
Nodes (50): opening(), ContentPageProps, metadata, LibraryPage(), LibraryPageProps, metadata, AskUs(), ContentState() (+42 more)

### Community 33 - "Admin Form Fields & Save"

Cohesion: 0.09
Nodes (52): SET_UP_AUTOMATICALLY list ('Summary for AI assistants: ON'), AdminTextField(), AdminTextFieldProps, ConflictNotice(), EditorSaveRow(), EditorSaveRowProps, AddSubjectForm(), ConfirmDelete() (+44 more)

### Community 34 - "Admin DB Rows"

Cohesion: 0.07
Nodes (56): writeSampleStaff(), addBetaTester(), AnyRow, BETA_TESTERS, BETA_TESTERS_TABLE, byKey(), Call, CATALOGUE (+48 more)

### Community 35 - "About Photo Editors"

Cohesion: 0.10
Nodes (52): About photo warnings (not 4:3, smaller than 1200x900), AboutSectionEditor(), ClosingEditor(), FormOf, GrowthEditor(), HeaderEditor(), listPlaceholders(), MissionEditor() (+44 more)

### Community 36 - "Legal Pages"

Cohesion: 0.07
Nodes (32): findDocuments, generateMetadata(), LegalPage(), LegalPageProps, LegalBody(), LegalBodyProps, DOCUMENT, withEmailLinks() (+24 more)

### Community 37 - "Env, Headers & Seed Bucket"

Cohesion: 0.06
Nodes (44): SUPABASE_SECRET_KEY (server-only), nextConfig, securityHeaders, local(), signInClient(), bucketObjectPath(), bucketPublicUrl(), CATALOGUE_BUCKET (+36 more)

### Community 38 - "Staff Accounts & Invites"

Cohesion: 0.08
Nodes (48): AdminDialog(), AdminDialogButton(), AdminDialogButtons(), AdminDialogTone, BARS, BUTTONS, callAdminAction(), TurnOffBanner() (+40 more)

### Community 39 - "Config & Middleware"

Cohesion: 0.07
Nodes (32): NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (renamed from ANON_KEY, no fallback), @supabase/ssr, @supabase/supabase-js, computeAuthDisabled(), Config, config, isAnalyticsConfigured, isSupabaseConfigured (+24 more)

### Community 40 - "Paths & Exam Hero"

Cohesion: 0.08
Nodes (37): ExamPage(), ExamPageProps, findExam, generateMetadata(), isCanonical(), CompareTable(), ExamHeroProps, STACK (+29 more)

### Community 41 - "Mock FAQs Store"

Cohesion: 0.08
Nodes (46): EditFaqProps, FaqEditorActions, NewFaqProps, FaqPanelProps, faqSlugFor(), newFaqForm(), FAQ, cut() (+38 more)

### Community 42 - "Mock Exam Pages Store"

Cohesion: 0.10
Nodes (51): staffSetOfficialDate(), createExam(), alreadyAnExam(), alreadyASubject(), checkSubject(), contentCount(), contentList(), examDeleteBlocker() (+43 more)

### Community 43 - "Catalogue Schema & Bucket"

Cohesion: 0.04
Nodes (49): MARKETPLACE_HOSTS, arms(), getExamByCode, getExamPage, getProductBySlug, getSitePage, getWebsiteSettings, listBestSellers (+41 more)

### Community 44 - "Product Editor Form"

Cohesion: 0.07
Nodes (41): EditProduct(), FLAG_ROWS, FORMAT_OPTIONS, NEVER_SAVED, NewProduct(), photosIn(), ProductFields(), SeoField() (+33 more)

### Community 45 - "Member Service Types"

Cohesion: 0.07
Nodes (28): SessionEndedProps, UseThisDeviceProps, ExamCountdownProps, isDatabaseConfigured, ExamDateSetBy, MemberWithExam, ContentKind, databaseArm (+20 more)

### Community 46 - "Admin Action Editors"

Cohesion: 0.05
Nodes (41): metadata, RootLayout(), viewport, AnnouncementEditor(), add(), edit(), move(), remove() (+33 more)

### Community 47 - "Sidebar UI Primitives"

Cohesion: 0.09
Nodes (44): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage(), Input(), Separator() (+36 more)

### Community 48 - "Access Check & Mock Content"

Cohesion: 0.06
Nodes (41): BOOT, decisionOf(), EDITOR, FREE_DECK, HIDDEN_QUIZ, { jar }, LOCKED_QUIZ, OWNER (+33 more)

### Community 49 - "Catalogue DB Rows"

Cohesion: 0.07
Nodes (45): MARKETPLACES, getExamByCode, getExamPage, getProductBySlug, getSitePage, getWebsiteSettings, listBestSellers, listExams (+37 more)

### Community 50 - "Admin Shell & Screens"

Cohesion: 0.06
Nodes (39): AdminShellLayout(), { jar }, SCREENS, addInvite, changeStaffMemberRole, saveContactEmail, saveLinks, saveTrustFigures (+31 more)

### Community 51 - "Exam Page Forms"

Cohesion: 0.06
Nodes (34): ExamSectionSwitchProps, bundleFormValues(), dateFormValues(), headerFormValues(), subjectFormValues(), ExamSectionRow, BOOT, EDITOR (+26 more)

### Community 52 - "Staff Settings Actions"

Cohesion: 0.07
Nodes (43): cancelStaffInvite, removeStaffMember, renewStaffInvite, adminAction(), EDITOR, IDLE, { jar }, OWNER (+35 more)

### Community 53 - "llms.txt & Domain Types"

Cohesion: 0.07
Nodes (33): NewProductProps, CompareTableProps, ExamsMenuProps, BestSellerCardProps, ExamPanelProps, FindYourExamProps, FormatsProps, ProductPickerProps (+25 more)

### Community 54 - "Admin A11y & E2E Helpers"

Cohesion: 0.07
Nodes (28): BLOCKING_IMPACTS, KEYBOARD_SCREENS, SIZES, editor(), expect, saveState(), E2E_PASSWORD, ensurePasswordUser() (+20 more)

### Community 55 - "Member App E2E"

Cohesion: 0.09
Nodes (31): expect, ADR-0011, agreeToConsent(), BLOCKING_IMPACTS, consentScreen(), daysFromToday(), examForm(), expectNoBlockingViolations() (+23 more)

### Community 56 - "DB Schema & Seed Tests 2"

Cohesion: 0.04
Nodes (42): accessPasses, accessPassGrants, announcementMessages, betaTesters, contentVisibility, decks, deniedReason, deniedSignIns (+34 more)

### Community 57 - "Catalogue & Content Tables"

Cohesion: 0.06
Nodes (31): "announcement_messages", "exam_pages", "exams", "faqs", "product_listings", "product_photos", "product_subjects", "product_variations" (+23 more)

### Community 58 - "Staff Guard"

Cohesion: 0.07
Nodes (32): signOut(), DeniedPage(), DeniedPageProps, metadata, AdminLayout(), metadata, metadata, OverviewPage() (+24 more)

### Community 59 - "Product Form & Peso"

Cohesion: 0.08
Nodes (30): generateMetadata(), groupedPesos, ParsedPeso, parsePeso(), pesoText(), figureText(), generatedProductCopy(), productFormValues() (+22 more)

### Community 60 - "Site Footer & Promo Strip"

Cohesion: 0.08
Nodes (28): section(), SHOP_LINKS, shopButtons(), stores(), ExternalLink(), PromoButton(), PromoStrip(), PromoStripProps (+20 more)

### Community 61 - "Catalogue Read Rules"

Cohesion: 0.09
Nodes (38): ascending(), bestSelling, by(), byTitle(), catalogueReads(), getExamByCode(), getExamPage(), getProductBySlug() (+30 more)

### Community 62 - "FAQ Editor"

Cohesion: 0.08
Nodes (32): ChipLabelField(), DeleteFaqProps, EditFaq(), FaqFields(), FaqFieldsProps, Flag, FlagRow(), NEVER_SAVED (+24 more)

### Community 63 - "v1 Spec Seams & Surfaces"

Cohesion: 0.07
Nodes (29): Load the catalogue once, Admin seam, Admin Settings (Owner), Admin Surface, Catalogue seam, pnpm catalogue:seed, Conflict check (last-saved stamp), Development password sign-in (+21 more)

### Community 64 - "Spreadsheet Parsing"

Cohesion: 0.08
Nodes (37): FieldError, isoDate(), PESOS, pesosToCentavos(), pipeList(), rating(), readCsv(), Sheet (+29 more)

### Community 65 - "Review & FAQ Actions"

Cohesion: 0.08
Nodes (36): addFaq, addReview, moveFaqInGroup, moveReviewOnHome, removeFaq, removeReview, saveFaq, saveReview (+28 more)

### Community 66 - "Admin Form Hook"

Cohesion: 0.09
Nodes (32): FormParts, LastChanged(), LINK_FIELDS, linkText(), linkValues(), PartProps, SettingsAction, SettingsEditor() (+24 more)

### Community 67 - "Retired Tenancy Specs"

Cohesion: 0.08
Nodes (32): Add the first Owner to the staff list, Spec: Multi-tenant foundation (superseded), getActiveOrg / requireOrgRole / hasOrgRole / isPlatformSuperadmin, Membership, Org Role (owner/admin/member), Organization, Platform Role superadmin, Workspace switcher in Dashboard Shell (+24 more)

### Community 68 - "Sample Data Reset Route"

Cohesion: 0.10
Nodes (25): server-only, resetSampleData(), { getStaff, restoreSampleData }, OWNER, post(), POST(), editSampleData(), routeWithDatabase() (+17 more)

### Community 69 - "Prompt 01 Shell & Beta Gate"

Cohesion: 0.09
Nodes (30): Executer prompt 01: Member App shell, sign-in and beta gate, Admin Users screen (Owner-only Beta Testers tab), Beta Tester list (beta_testers table), MEMBER_APP_LIVE switch (memberAppLive), Member App shell (sidebar, mobile drawer, placeholder Home), members table / Member record, Not open yet screen, OAuth callback route (/auth/callback) (+22 more)

### Community 70 - "Mock Topics & Testers"

Cohesion: 0.16
Nodes (35): asNewTester(), alreadyATopic(), andList(), roleRefusal(), topicDeleteBlocker(), topicContentOf(), topicsOf(), addBetaTester() (+27 more)

### Community 71 - "About Hero & Subject Chips"

Cohesion: 0.08
Nodes (24): AboutHeroProps, SubjectChips(), SubjectChipsProps, renderChips(), SUBJECTS, MOVES, PHOTOS, PLACEHOLDER_PHOTO (+16 more)

### Community 72 - "Runtime Dependencies"

Cohesion: 0.06
Nodes (35): dependencies, class-variance-authority@^0.7.1, clsx@^2.1.1, dayjs@^1.11.13, drizzle-orm@^0.45.2, @hookform/resolvers@^4.1.3, lucide-react@^0.469.0, next@^15.5.7 (+27 more)

### Community 73 - "Catalogue Import Runner"

Cohesion: 0.11
Nodes (25): prettier, REPO, { values, positionals }, GeneratedCatalogue, HandMaintained, Outcome, REPO, publishPhotos() (+17 more)

### Community 74 - "Admin Products Page"

Cohesion: 0.10
Nodes (29): addProduct, countProductDelete, createPhotoUpload, removeProduct, saveProduct, setProductFlag, IDLE, { jar } (+21 more)

### Community 75 - "Spreadsheet Build"

Cohesion: 0.08
Nodes (34): build(), locate(), byOrder(), columnOf(), convertSpreadsheet(), read(), ErrorLocation, EXAM_COLUMNS (+26 more)

### Community 76 - "Prompts 11-17 Quiz & Access"

Cohesion: 0.12
Nodes (28): Grant and Extension Lengths, Access decision (ticket 05), Executer prompt 11: Quiz taking, Member seam (sample and database arms), Pure quiz grader, Quiz Attempt record, quizStart, quiz and score screens, Removed question marker in old attempts (+20 more)

### Community 77 - "ADR 0010 Access Model"

Cohesion: 0.09
Nodes (24): Course Ownership, ADR 0010: Access follows the Exam, Access Pass, Free Preview flag, Access check questions, Access decision seam, Asia/Manila day boundaries, Burned-in watermark (+16 more)

### Community 78 - "Mock Products Store"

Cohesion: 0.13
Nodes (33): FieldsForm, PHOTO_TO_GO_LIVE, productFlagsSchema, ProductForm, productFormSchema, ProductInput, adminProductOf(), compareRows() (+25 more)

### Community 79 - "Prompt 06 Card Import"

Cohesion: 0.11
Nodes (25): Manila time helpers (src/lib/manila-time.ts), Executer prompt 06: Card import, cards table (front_hash, cascade from decks), Catalogue importer (src/lib/catalogue-import/) prior art, Conflict check (record_stamps), Private 'content' Storage bucket, 'Did you rename it?' Topic hint, Upload seam (one-time signed upload URLs) (+17 more)

### Community 80 - "Dev Dependencies"

Cohesion: 0.06
Nodes (33): devDependencies, @axe-core/playwright@^4.12.1, @commitlint/config-conventional@^19.8.0, csv-parse@^7.0.3, dotenv@^17.4.2, eslint-config-next@^15.5.7, @playwright/test@^1.50.1, prettier@^3.5.3 (+25 more)

### Community 81 - "Site Page SEO Editor"

Cohesion: 0.11
Nodes (24): SET_UP_AUTOMATICALLY, SitePageSeoEditor(), DEFAULTS, faq(), network, renderEditor(), router, SAVED_AT (+16 more)

### Community 82 - "Admin Product List"

Cohesion: 0.11
Nodes (25): BADGES, linkCountColour(), NO_FILTERS, ProductList(), ProductListRow(), ProductListRowProps, StoreLinkBadge(), CARDS (+17 more)

### Community 83 - "Prompt 12 Reviewer PDF Job"

Cohesion: 0.12
Nodes (25): Deck Resume Position, Admin Reviewer PDFs screen (upload, list, progress, delete), Batched page rendering (~25 pages per run, 1600px WebP), CRON_SECRET server-only env var, Executer prompt 12: Reviewer PDF upload and processing job, Failure reasons with fixes, Fixture PDFs (3-page, password-protected, corrupt), Page-images interface with in-memory fake (+17 more)

### Community 84 - "Dropdown Menu UI"

Cohesion: 0.08
Nodes (18): lucide-react, radix-ui, BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage(), BreadcrumbSeparator() (+10 more)

### Community 85 - "README, CI & Seam ADRs"

Cohesion: 0.10
Nodes (25): Setup composite action (pnpm, Node 22.23.1, frozen lockfile), Dependabot config (weekly npm + GitHub Actions), Pull request template, CI workflow, CI job: database (pnpm test:db on local Supabase), CI job: dependency-review (fail on high severity), CI job: e2e-admin (sample data, 2 shards), CI job: e2e-admin-live (local Supabase, 3 shards) (+17 more)

### Community 86 - "Website E2E Specs"

Cohesion: 0.07
Nodes (7): expect, productEditor(), productField(), expect, expect, EXAMS, @playwright/test

### Community 87 - "Admin Types & Writes"

Cohesion: 0.15
Nodes (25): AboutSectionForm, aboutSectionFormSchema, AboutSectionUpdate, PHOTO_NOT_UPLOADED, SHARE_IMAGE_NOT_UPLOADED, WAIT_FOR_UPLOADS, sitePageDefaults(), photoAlt() (+17 more)

### Community 88 - "Member App Grilling Decisions"

Cohesion: 0.11
Nodes (16): Access Pass, ADR 0009 (anonymous analytics), Phase 3 Grilling Notes, Quiz Attempt, Device Switch Log, Access Pass Record (per Member per Exam), Deck Player (flashcards), Server-side Quiz Marking (+8 more)

### Community 89 - "Package Tooling"

Cohesion: 0.08
Nodes (25): author, @commitlint/cli@^19.8.0, eslint@^9.23.0, husky@^9.1.7, jsdom@^26.0.0, lint-staged@^15.4.3, tailwindcss@^4.0.0, tw-animate-css@^1.2.4 (+17 more)

### Community 90 - "FAQ Explorer"

Cohesion: 0.14
Nodes (18): Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger(), faqElementId(), FaqExplorer(), FaqExplorerProps, FaqItem() (+10 more)

### Community 91 - "About Page Content"

Cohesion: 0.16
Nodes (19): Field limit = ~1.5x default length rounded up to next 10, PhotoFieldProps, aboutCopy, AboutPhoto, missionTabs, storyPhotos, teamPhoto, ABOUT_ALT_MAX (+11 more)

### Community 92 - "Import Photo Staging"

Cohesion: 0.14
Nodes (21): sharp@^0.35.5, sharp, Conversion, isFile(), isFileName(), isProductsPath(), optimise(), Optimised (+13 more)

### Community 93 - "Prompt 16 Users & Members"

Cohesion: 0.18
Nodes (19): Admin seam (sample and database arms), Staff Activity logging, Executer prompt 16: Users list, Member detail and force sign-out, Force sign-out with logged reason, Member detail page, URL-driven search, filters and paging, Owner-only Users list, Member App Account page (+11 more)

### Community 94 - "npm Scripts"

Cohesion: 0.09
Nodes (23): scripts, build, catalogue:import, catalogue:seed, db:check, db:generate, db:reset, db:start (+15 more)

### Community 95 - "shadcn UI Primitives"

Cohesion: 0.12
Nodes (15): class-variance-authority, AdminDialogProps, Badge(), badgeVariants, Button(), buttonVariants, DialogContent(), DialogDescription() (+7 more)

### Community 96 - "Beta Gate & Legal Draft"

Cohesion: 0.10
Nodes (20): ADR 0008, Beta Testers Tab (Owner-only Users screen), Member App Shell (sidebar, drawer), Member Record, Safe-next Redirect Rule, Ticket 01: Member App Shell, Sign-in and Beta Gate, Consent Record (Terms and Privacy versions), Consent Screen (+12 more)

### Community 97 - "Target Exams Screen"

Cohesion: 0.15
Nodes (18): account(), actions(), added(), addExam(), addExamPage(), BEA_ID, BOOT, changeExamDate() (+10 more)

### Community 98 - "TypeScript Config"

Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+12 more)

### Community 99 - "Seam & Clean Arch Skills"

Cohesion: 0.13
Nodes (17): ADR 0003 Mock-First Service Seam, clean-architecture Skill, The Dependency Rule (dependencies point inward), DTOs at the Boundary (not raw rows), Refactoring in Small Green Steps (Kent Beck), Service Seam (src/services/*), CustomersTable Reference Pattern, ADR 0005 Multi-Tenancy (retired track) (+9 more)

### Community 100 - "Config & Middleware 2"

Cohesion: 0.17
Nodes (13): analyticsSessionReplay, authDisabled, buildCsp(), CspOptions, isAdminPath(), isUnder(), needsSession(), SESSION_PREFIXES (+5 more)

### Community 101 - "Admin Exam Pages View"

Cohesion: 0.14
Nodes (17): ABOUT_RATIO, ABOUT_SECTION_DESCRIPTIONS, ABOUT_SECTION_TITLES, EDITORS, examDateWarning(), ExamPagesPage, isAboutEditor(), isEditor() (+9 more)

### Community 102 - "Overview Needs Attention"

Cohesion: 0.19
Nodes (18): AttentionKind, counted(), daysBetween(), hiddenItem(), listOf(), missingLinksItem(), needsAttention(), promoItem() (+10 more)

### Community 103 - "Product Photos E2E"

Cohesion: 0.17
Nodes (17): isUploadPut(), publicUrlOf(), uploadPathOf(), addPhotos(), editor(), expect, FIXTURE, fixtureAs() (+9 more)

### Community 104 - "Overview Needs Attention 2"

Cohesion: 0.21
Nodes (15): PromoBannerEditorProps, dayMonth(), MONTHS, OFF, partsOf(), PromoStatus, promoStatus(), PromoStatusKind (+7 more)

### Community 105 - "Drizzle & RLS Skills"

Cohesion: 0.16
Nodes (15): CatalogueService Contract, Dependency Inversion at the Seam, RLS Enabled on Every Exposed Table + Cross-User Denial Test, Database Tests (*.db.test.ts via TEST_DATABASE_URL), drizzle-data Skill, Lazy getDb() Client (no connection at import/build), Server-Only Secrets in src/env.server.ts (DATABASE_URL, SUPABASE_SECRET_KEY), import "server-only" Environment Isolation (+7 more)

### Community 106 - "shadcn Config"

Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 107 - "Sitewide A11y E2E"

Cohesion: 0.15
Nodes (12): BLOCKING_IMPACTS, NOT_FOUND, PUBLIC_PAGES, SHELL_PAGES, STATIC_PAGES, expect, isUnder(), pathOf() (+4 more)

### Community 108 - "Site Pages E2E"

Cohesion: 0.15
Nodes (11): editor(), expect, saveState(), SHARE_IMAGE, BASE_URL, LIVE, PORT, SERVER (+3 more)

### Community 109 - "Product Panel & Delete"

Cohesion: 0.14
Nodes (13): actionsWith(), answering(), [FIRST = "", SECOND = ""], network, POSTERS, PREVIEW, renderPosters(), router (+5 more)

### Community 110 - "Import Test Fixtures"

Cohesion: 0.20
Nodes (12): SheetName, COMING_SOON_PRODUCT, csv(), LIVE_PRODUCT, saveSpreadsheet(), HAND_MAINTAINED, productRow(), SheetRecords (+4 more)

### Community 111 - "Next.js, CSP & PostHog Skills"

Cohesion: 0.15
Nodes (13): anime-js Skill (v4, install-on-demand), createScope().revert() Cleanup on Unmount, prefers-reduced-motion Guard, Next 15 Async Request APIs (await headers/cookies/params), Edge Middleware Nonce CSP (buildCsp), nextjs-app-router Skill (Next 15, React 19), ADR 0007 Analytics PostHog, Consent-Gated Capture (GDPR) (+5 more)

### Community 112 - "UI & Forms Skills"

Cohesion: 0.20
Nodes (16): data-tables Skill (TanStack Table v8), Headless TanStack Table Rendered with shadcn Table, Referentially Stable columns/data, forms-validation Skill (react-hook-form + zod), shadcn Form Primitives (Form, FormField, FormMessage), Convention Skill Format (When to use, Version, Core standards, In this template, Red flags, Sources), Project Convention Skills Index, cn() + cva + asChild Composition (+8 more)

### Community 113 - "Sitemap & SEO"

Cohesion: 0.16
Nodes (14): RFC-9309, robots(), buildRobots(), buildSitemap(), CATALOGUE, DISALLOWED, HOME, OTHER (+6 more)

### Community 114 - "Secrets & Env Guards"

Cohesion: 0.12
Nodes (10): filesContaining(), OLD_KEY_NAME, PUBLIC_SECRET, repoFiles(), SECRET_KEY_NAME, SKIPPED, CONNECTION_STRING, KEY_PATTERNS (+2 more)

### Community 115 - "App Layout & OG Images"

Cohesion: 0.18
Nodes (13): AppleIcon(), contentType, size, BRAND_COLORS, brandMark(), VIEW_BOX, contentType, Icon() (+5 more)

### Community 116 - "App Layout & OG Images 2"

Cohesion: 0.18
Nodes (10): Error(), fontVariables, jetBrainsMono, schibstedGrotesk, GlobalError(), metadata, NotFound(), metadata (+2 more)

### Community 117 - "Admin Exam Pages View 2"

Cohesion: 0.24
Nodes (16): Card(), CardProps, ExamChips(), ExamChipsProps, ExamPageColumn(), ExamPageColumnProps, NotOnSiteNotice(), SeoStateLabel() (+8 more)

### Community 118 - "CI Workflow Config"

Cohesion: 0.12
Nodes (15): concurrency, cancel-in-progress, group, runs-on, timeout-minutes, env, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_URL (+7 more)

### Community 119 - "Admin Exam Pages View 3"

Cohesion: 0.23
Nodes (15): announcementEditor(), ExamPagesPage(), ExamPagesPageProps, metadata, promoEditor(), sitePage(), ExamPagesNav(), NewExamColumn() (+7 more)

### Community 120 - "Reviews & Best Sellers UI 2"

Cohesion: 0.16
Nodes (8): cardQuoting(), cards(), firstCard(), PageModule, quotes(), Seam, SearchParams, wall()

### Community 121 - "Beta Testers Admin"

Cohesion: 0.16
Nodes (11): BetaTesters(), add(), answer(), remove(), refusalText(), BEA, NEW, OWNER (+3 more)

### Community 122 - "Admin Types & Writes 2"

Cohesion: 0.17
Nodes (13): aboutSectionFormValues(), photo(), slots(), text(), AboutSectionRow, BOOT, EDITOR, FormOf (+5 more)

### Community 123 - "Website Shell Ticket"

Cohesion: 0.17
Nodes (9): Ticket 01: Branded Website shell and Exams menu, Announcement bar (rotating, dismissible), Peso-to-centavo price conversion, Ticket 13: Template cleanup, Catalogue seam as documented Reference Feature, Executer prompt: Ticket 01: Branded Website shell and Exams menu, CatalogueService interface (listExams, getExamByCode, getWebsiteSettings), formatPeso(centavos) (+1 more)

### Community 124 - "Mockup Data Script"

Cohesion: 0.15
Nodes (11): CONTACT, DIGITAL, EXAM_INFO, EXAMS, PENDING, peso(), PRODUCTS, raw (+3 more)

### Community 125 - "Promo E2E Spec"

Cohesion: 0.22
Nodes (10): bannerForm(), dayMonth(), editor(), expect, message(), MONTHS, openPromo(), saveBanner() (+2 more)

### Community 126 - "Product & Reviews Tickets"

Cohesion: 0.21
Nodes (12): Ticket 02: Product page, No rating or review structured data, Products filters reflected in the URL, Best sellers carousel (top 6 by units sold), Ticket 07: Reviews page, Reviews wall filters, sorts and URL state, Executer prompt: Ticket 02: Product page, getProductBySlug / listProducts / listReviews seam methods (+4 more)

### Community 127 - "Website Ticket Plan"

Cohesion: 0.25
Nodes (12): Ticket 10: Legal pages, Ticket 12: Catalogue spreadsheet template and seed converter, Executer prompt: Ticket 04: Exam pages, Executer prompt: Ticket 05: Home, top half, Executer prompt: Ticket 07: Reviews page, Executer prompt: Ticket 10: Legal pages, Executer prompt: Ticket 12: Catalogue spreadsheet template and seed converter, Executer prompt: Ticket 13: Template cleanup (+4 more)

### Community 128 - "CI Job Steps"

Cohesion: 0.22
Nodes (14): steps, steps, steps, runs-on, steps, timeout-minutes, e2e-website, verify (+6 more)

### Community 129 - "Member Coming Soon Pages"

Cohesion: 0.22
Nodes (11): comingSoon(), ComingSoonPage(), ComingSoonPageProps, generateMetadata(), comingSoon(), firstName(), isCurrentItem(), MEMBER_MENU (+3 more)

### Community 130 - "About Page Content 2"

Cohesion: 0.18
Nodes (12): field(), form(), network, opened(), renderEditor(), router, saveButton(), SAVED_AT (+4 more)

### Community 131 - "Form & Label UI"

Cohesion: 0.21
Nodes (11): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue, FormLabel() (+3 more)

### Community 132 - "Coding Standards & Commits"

Cohesion: 0.21
Nodes (13): Handoff Prompt Sections (Goal, Context, Scope, Approach, Acceptance, Verification, Guardrails), /ship Command, /verify Command, Branch Off main, Never Commit to main, coding-standards 12-Category Checker, Coding Standards Spec (docs/superpowers/specs/2026-07-31-coding-standards.md), Conventional Commits, No any / no ! / no as-to-silence TypeScript Rules (+5 more)

### Community 133 - "CI Dependency Review"

Cohesion: 0.15
Nodes (13): if, permissions, runs-on, steps, dependency-review, contents, with, fail-on-severity (+5 more)

### Community 134 - "Chart UI"

Cohesion: 0.22
Nodes (12): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartStyle(), ChartTooltipContent(), getPayloadConfigFromPayload() (+4 more)

### Community 135 - "Announcement Bar"

Cohesion: 0.23
Nodes (9): AnnouncementBar(), dismiss(), AnnouncementBarProps, prefersReducedMotion(), readDismissedId(), readDismissedIdOnServer(), rememberDismissed(), subscribeToStorage() (+1 more)

### Community 136 - "Catalogue Service Reads 2"

Cohesion: 0.26
Nodes (8): cta(), AboutPage(), readAbout(), AboutCta(), AboutCtaProps, AboutHero(), OurStory(), getSitePage

### Community 137 - "Settings E2E Spec"

Cohesion: 0.27
Nodes (10): contactPart(), expect, figuresPart(), linksPart(), MANILA_DATE, openSettings(), part(), saveContactEmail() (+2 more)

### Community 138 - "Staff E2E Spec"

Cohesion: 0.23
Nodes (10): accounts(), accountsStatus(), EDITOR, expect, EXPIRED, EXPIRY_DAY, KIM, openSettings() (+2 more)

### Community 139 - "Staff Accounts & Invites 2"

Cohesion: 0.20
Nodes (8): EDITOR, KIM, LIST, { refresh }, renderAccounts(), row(), rowOf(), unused()

### Community 140 - "Dialog & Error UI"

Cohesion: 0.36
Nodes (9): ErrorState(), ErrorStateProps, Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader() (+1 more)

### Community 141 - "Mission Tabs"

Cohesion: 0.36
Nodes (7): Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger(), MissionTabs(), FindYourExam()

### Community 142 - "Admin Arms Tests"

Cohesion: 0.17
Nodes (6): BOOT, EDITOR, EXPIRED, JUAN, KIM, OWNER

### Community 143 - "Supabase Auth Skill"

Cohesion: 0.22
Nodes (8): Opt-In / Inert Analytics by Default (NEXT_PUBLIC_POSTHOG_KEY), ADR 0002 Auth Wired Directly to Supabase, Configured-or-Disabled Auth (dev bypass, prod fail-closed), Cookie Adapter get/set/remove Shape, Middleware Session Refresh on Session Routes, supabase-auth Skill, Three @supabase/ssr Client Contexts (browser, server, middleware), webServer with Placeholder Supabase Env

### Community 144 - "Prompt 05 Content Model"

Cohesion: 0.31
Nodes (10): Executer prompt 05: Content model, Topics editor, Library and access decision, access_pass_grants history, access_passes (one per Member per Exam, ends_at), ADR 0010 (access follows the Exam; active Staff see Visible content), decks, quizzes, reviewer_pdfs (one per Topic, FK ON DELETE RESTRICT), Exam/Subject delete blockers extended for Topic content, Library (/app/library), 'Opening soon' content-item placeholder (+2 more)

### Community 145 - "Row Diff"

Cohesion: 0.25
Nodes (7): AnyRow, diffRows(), keyed(), RowDiff, same(), Row, withNulls()

### Community 146 - "Products Page Tests"

Cohesion: 0.22
Nodes (7): grid(), gridNames(), loadPage(), PageModule, pages, renderPage(), SearchParams

### Community 147 - "Admin Shell & Sidebar"

Cohesion: 0.44
Nodes (8): AdminDrawer(), Sheet(), SheetContent(), SheetFooter(), SheetOverlay(), SheetPortal(), SheetTitle(), SheetTrigger()

### Community 148 - "Select UI"

Cohesion: 0.22
Nodes (7): SelectContent(), SelectItem(), SelectLabel(), SelectScrollDownButton(), SelectScrollUpButton(), SelectSeparator(), SelectTrigger()

### Community 149 - "FAQ Page Ticket"

Cohesion: 0.24
Nodes (9): Catalogue seed validation, Ticket 08: FAQ page, FAQs in the Catalogue seam (5 fixed groups), FAQPage JSON-LD (visible FAQs only), FAQ Review quote must exist word for word in a seeded Review, validateCatalogueSeed(), Executer prompt: Ticket 08: FAQ page, faqPageJsonLd(groups) (+1 more)

### Community 151 - "FAQs E2E Spec"

Cohesion: 0.31
Nodes (8): editor(), expect, faqPageGroup(), FaqPageJsonLd, openFaqs(), questions(), row(), saveState()

### Community 152 - "Product Editor E2E"

Cohesion: 0.33
Nodes (9): CARDS, editor(), expect, field(), openEditor(), POSTERS, save(), saveState() (+1 more)

### Community 153 - "FAQ E2E Spec"

Cohesion: 0.22
Nodes (3): faq(), faqButton(), FaqPageJsonLd

### Community 154 - "Products E2E Spec"

Cohesion: 0.24
Nodes (4): card(), expect, grid(), gridNames()

### Community 155 - "Identity Live Tests"

Cohesion: 0.27
Nodes (6): { auth, jar }, claims(), identityIn(), identityWith(), loadIdentity(), signedInWith()

### Community 156 - "SEO Editors & Check"

Cohesion: 0.29
Nodes (6): fullTitle(), SEO_DESCRIPTION_MAX, SEO_DESCRIPTION_MIN, SEO_PAGE_TITLE_MAX, seoCheck(), WHOLE_TITLE_MAX

### Community 157 - "Admin Reviews Tests"

Cohesion: 0.20
Nodes (7): ALL_REVIEWS, BOOT, EDITOR, HOME_ORDER, LAZADA_REVIEW, OWNER, NewReviewForm

### Community 158 - "Claude Agent Config"

Cohesion: 0.33
Nodes (5): Project Subagents (empty, global agents), /handoff Command, RISEN Prompt Framework (role, steps, end product, constraints), `.claude/` Agent Configuration, settings.json (permission allowlist + hooks)

### Community 159 - "Reviewer PDF Job Design"

Cohesion: 0.25
Nodes (8): Reviewer Page Images ~1600px WebP, ADR 0012, Job Failure Reasons with Fixes, Page-Images Interface (renderer + storage seam), Resumable Upload to Private Storage, Reviewer PDF Job Row and Batch Renderer, Stale Job Restart Cron, Ticket 12: Reviewer PDF Upload and Processing Job

### Community 160 - "Exam Pages E2E"

Cohesion: 0.31
Nodes (6): editor(), expect, openExamPages(), saveState(), SHARE_IMAGE, SQUARE_IMAGE

### Community 161 - "Products List E2E"

Cohesion: 0.39
Nodes (6): count(), examChip(), expect, openProducts(), products(), row()

### Community 162 - "Admin Reviews E2E"

Cohesion: 0.33
Nodes (6): editor(), expect, openReviews(), pinSwitch(), row(), saveState()

### Community 163 - "Reviews E2E Spec"

Cohesion: 0.25
Nodes (3): cards(), expect, wall()

### Community 164 - "ESLint Config"

Cohesion: 0.22
Nodes (6): compat, __dirname, eslintConfig, __filename, @eslint/eslintrc@^3.3.1, @eslint/eslintrc

### Community 165 - "CI E2E Admin Matrix"

Cohesion: 0.25
Nodes (9): strategy, name, runs-on, strategy, timeout-minutes, e2e-admin, shard, fail-fast (+1 more)

### Community 166 - "Admin Permission Tests 2"

Cohesion: 0.25
Nodes (5): column(), { jar }, Params, renderPage(), sectionRows()

### Community 167 - "About Page Content 3"

Cohesion: 0.28
Nodes (7): MissionTabsProps, OurStoryProps, PHOTO_FRAMES, STEP_DOTS, ABOUT_SECTION_IDS, MissionTab, AboutCopy

### Community 168 - "Beta Testers E2E"

Cohesion: 0.46
Nodes (7): add(), expect, openUsers(), row(), rows(), status(), testers()

### Community 169 - "CI Database Job"

Cohesion: 0.25
Nodes (8): runs-on, steps, timeout-minutes, TEST_DATABASE_REQUIRED, TEST_DATABASE_URL, database, env, name

### Community 170 - "PostHog Instrumentation"

Cohesion: 0.32
Nodes (5): posthog-js@^1.409.5, posthog-js, loadInstrumentation(), ADR-0009, ADR-0009

### Community 171 - "Member Shell Tests"

Cohesion: 0.25
Nodes (7): BEA, CE, ME, renderDrawer(), shell, signOut, switchExam

### Community 172 - "About Page Ticket"

Cohesion: 0.33
Nodes (7): marketplace_click analytics event, Store buttons (Listing, then shop page, else hidden), Ticket 09: About page, Computed About stats, trackMarketplaceClick(), Executer prompt: Ticket 09: About page, aboutStats({ productTotal, examCount, shopStats })

### Community 173 - "Products Page Ticket"

Cohesion: 0.33
Nodes (7): Coming Soon Product rules (no price, never P0, no buy buttons), Ticket 03: Products page, Help me choose picker, Computed Exam stats (Live Products only), Executer prompt: Ticket 03: Products page, recommendProduct(liveProducts, examCode, style), examStats(products)

### Community 174 - "Home Bottom Ticket"

Cohesion: 0.38
Nodes (7): Ticket 06: Home, bottom half, Which format fits how you study? format cards, Dated promo strip in Asia/Manila time, formatAsOf(isoDate) / manilaYear(now), Executer prompt: Ticket 06: Home, bottom half, formatCardStats(liveProducts, exams), isPromoActive(banner, now)

### Community 176 - "Prettier Config"

Cohesion: 0.29
Nodes (6): plugins, printWidth, semi, singleQuote, tailwindStylesheet, trailingComma

### Community 179 - "Exam Schema Tests"

Cohesion: 0.38
Nodes (6): errors(), fieldErrorsOf(), passwordSignInSchema, errors(), parse(), websiteSettingsUpdateSchema

### Community 180 - "Sitemap Ticket"

Cohesion: 0.47
Nodes (6): Ticket 11: Sitemap, robots, Organization data and site-wide checks, Organization JSON-LD with sameAs links, Sitemap and robots built from the Catalogue seam, Executer prompt: Ticket 11: Sitemap, robots, Organization data and site-wide checks, buildSitemap / buildRobots, organizationJsonLd(settings, siteUrl)

### Community 182 - "Admin SQL Schema"

Cohesion: 0.40
Nodes (5): "denied_sign_ins", denied_sign_ins_email_at_idx, "record_stamps", "staff", "staff_activity"

### Community 183 - "React 19 Reference"

Cohesion: 0.40
Nodes (5): <Context> as Provider, React 19 Reference, ref as a Prop (no forwardRef), useActionState, CustomerFormState

### Community 184 - "Home Top Ticket"

Cohesion: 0.40
Nodes (3): Ticket 05: Home, top half, Try a card flip widget, Site-wide checks (axe, 390px mobile, buying journey, no Member App leaks)

### Community 185 - "Exam Pages Ticket"

Cohesion: 0.40
Nodes (5): Ticket 04: Exam pages, CE bundle banner, Exam Review selection and display mode (marquee/grid/empty), Home Review selection (first 9 pinned), reviewDisplayMode(count)

### Community 186 - "Website Component Tests 2"

Cohesion: 0.50
Nodes (4): EXAMS, section(), tiles(), ABOUT_DEFAULTS

### Community 187 - "CI Live E2E Job"

Cohesion: 0.50
Nodes (4): name, runs-on, timeout-minutes, e2e-admin-live

### Community 191 - "Volta Toolchain"

Cohesion: 0.67
Nodes (3): volta, node, pnpm

## Ambiguous Edges - Review These

- `Opt-in / inert by default (isAnalyticsConfigured)` → `ADR 0009: Cookieless anonymous Website analytics, no consent banner` [AMBIGUOUS]
  docs/superpowers/handoffs/2026-07-31-posthog-analytics.md · relation: conceptually_related_to
- `ADR 0005 Multi-Tenancy (retired track)` → `ADR 0008 Staff List, No Tenancy` [AMBIGUOUS]
  .claude/skills/drizzle-data/references/drizzle-rls.md · relation: conceptually_related_to

## Knowledge Gaps

- **160 isolated node(s):** `ADR-0009`, `ADR-0009`, `RFC-9309`, `Merge-conflict hotspots (Catalogue seam files, paths.ts, a11y.spec.ts, Home page.tsx)`, `Phase 1 ticket run order (01,02,13,08,10,03,04,05,06,07,09,12,11)` (+155 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1857 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `DB Schema & Seed Tests` to `Admin Form Schemas`, `Website Component Tests`, `Product Page & Admin Toggles`, `Member App Gate & Tests`, `Sample Store & Exam Pages`, `Upload Storage Seam`, `Reviews & FAQ Lists`, `Admin Switches & Toasts`, `Catalogue Seed CLI`, `DB Check & Add Owner`, `Admin Editor Action Types`, `Home Page Sections`, `Member Sign-out & Consent`, `Member Account & Exams`, `Products Page Filters`, `Reviews & Best Sellers UI`, `Site Navigation`, `Active Device Screens`, `Admin Sign-in Method`, `Admin Permission Tests`, `Catalogue Service Reads`, `Admin Password Sign-in`, `Admin Settings Schemas`, `Review Editor`, `Member Library & Content`, `Admin DB Rows`, `About Photo Editors`, `Legal Pages`, `Env, Headers & Seed Bucket`, `Staff Accounts & Invites`, `Config & Middleware`, `Paths & Exam Hero`, `Mock FAQs Store`, `Mock Exam Pages Store`, `Catalogue Schema & Bucket`, `Product Editor Form`, `Admin Action Editors`, `Access Check & Mock Content`, `Catalogue DB Rows`, `Admin Shell & Screens`, `Exam Page Forms`, `Staff Settings Actions`, `llms.txt & Domain Types`, `Staff Guard`, `Product Form & Peso`, `Site Footer & Promo Strip`, `FAQ Editor`, `Spreadsheet Parsing`, `Review & FAQ Actions`, `Admin Form Hook`, `Sample Data Reset Route`, `About Hero & Subject Chips`, `Catalogue Import Runner`, `Admin Products Page`, `Dev Dependencies`, `Site Page SEO Editor`, `Admin Product List`, `Package Tooling`, `FAQ Explorer`, `About Page Content`, `Import Photo Staging`, `shadcn UI Primitives`, `Target Exams Screen`, `Config & Middleware 2`, `Admin Exam Pages View`, `Overview Needs Attention 2`, `Product Panel & Delete`, `Import Test Fixtures`, `Sitemap & SEO`, `Secrets & Env Guards`, `App Layout & OG Images 2`, `Reviews & Best Sellers UI 2`, `Beta Testers Admin`, `Admin Types & Writes 2`, `Member Coming Soon Pages`, `About Page Content 2`, `Announcement Bar`, `Staff Accounts & Invites 2`, `Dialog & Error UI`, `Mission Tabs`, `Admin Arms Tests`, `Row Diff`, `Products Page Tests`, `Identity Live Tests`, `SEO Editors & Check`, `Admin Reviews Tests`, `Admin Permission Tests 2`, `PostHog Instrumentation`, `Member Shell Tests`, `Admin Exam Pages View 4`, `Exam Schema Tests`, `Website Component Tests 2`, `Dev Dependencies 2`?**
  _High betweenness centrality (0.179) - this node is a cross-community bridge._
- **What connects `ADR-0009`, `ADR-0009`, `RFC-9309` to the rest of the system?**
  _160 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin Form Schemas` be split into smaller, more focused modules?**
  _Cohesion score 0.020574592248989974 - nodes in this community are weakly interconnected._
- **Why does `CONTEXT.md domain glossary` connect `Domain Glossary & ADRs` to `Beta Gate & Legal Draft`, `Retired Tenancy Specs`, `Admin Prompts 01-12`, `ADR 0010 Access Model`, `README, CI & Seam ADRs`, `Member App Grilling Decisions`, `Admin Prompts 13-25`, `Member App Ticket Decisions`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Should `Website Component Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.02670967741935484 - nodes in this community are weakly interconnected._

### Low-confidence Hints

_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Opt-in / inert by default (isAnalyticsConfigured)` and `ADR 0009: Cookieless anonymous Website analytics, no consent banner`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `ADR 0005 Multi-Tenancy (retired track)` and `ADR 0008 Staff List, No Tenancy`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
