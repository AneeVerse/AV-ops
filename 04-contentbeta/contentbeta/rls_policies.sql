CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM admins WHERE email = auth.email())
$$;

CREATE OR REPLACE FUNCTION my_brand_id()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT brand_id::text FROM users WHERE email = auth.email() LIMIT 1
$$;

ALTER TABLE admins                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_layouts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_posts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_angles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_angle_images         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppt_jobs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE banner_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppt_layouts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE carousel_layouts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE carousel_slide_prompts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE overlay_templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE infographic_layouts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_layouts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_prompts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_jobs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_concepts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE carousel_jobs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE infographic_jobs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE infographics            ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read admins" ON admins;
CREATE POLICY "Authenticated users can read admins"
  ON admins FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read brands" ON brands;
DROP POLICY IF EXISTS "Admins can insert brands" ON brands;
DROP POLICY IF EXISTS "Admins can update brands" ON brands;
DROP POLICY IF EXISTS "Admins can delete brands" ON brands;
CREATE POLICY "Authenticated users can read brands"
  ON brands FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can insert brands"
  ON brands FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update brands"
  ON brands FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can delete brands"
  ON brands FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS "Authenticated users can read brand_profiles" ON brand_profiles;
DROP POLICY IF EXISTS "Admins can insert brand_profiles" ON brand_profiles;
DROP POLICY IF EXISTS "Admins can update brand_profiles" ON brand_profiles;
DROP POLICY IF EXISTS "Admins can delete brand_profiles" ON brand_profiles;
CREATE POLICY "Authenticated users can read brand_profiles"
  ON brand_profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can insert brand_profiles"
  ON brand_profiles FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update brand_profiles"
  ON brand_profiles FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can delete brand_profiles"
  ON brand_profiles FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS "Authenticated users can read reference_categories" ON reference_categories;
DROP POLICY IF EXISTS "Admins can insert reference_categories" ON reference_categories;
DROP POLICY IF EXISTS "Admins can update reference_categories" ON reference_categories;
DROP POLICY IF EXISTS "Admins can delete reference_categories" ON reference_categories;
CREATE POLICY "Authenticated users can read reference_categories"
  ON reference_categories FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can insert reference_categories"
  ON reference_categories FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update reference_categories"
  ON reference_categories FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can delete reference_categories"
  ON reference_categories FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS "Authenticated users can read reference_layouts" ON reference_layouts;
DROP POLICY IF EXISTS "Admins can insert reference_layouts" ON reference_layouts;
DROP POLICY IF EXISTS "Admins can update reference_layouts" ON reference_layouts;
DROP POLICY IF EXISTS "Admins can delete reference_layouts" ON reference_layouts;
CREATE POLICY "Authenticated users can read reference_layouts"
  ON reference_layouts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can insert reference_layouts"
  ON reference_layouts FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update reference_layouts"
  ON reference_layouts FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can delete reference_layouts"
  ON reference_layouts FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS "Authenticated users can read ad_angles" ON ad_angles;
DROP POLICY IF EXISTS "Admins can insert ad_angles" ON ad_angles;
DROP POLICY IF EXISTS "Admins can update ad_angles" ON ad_angles;
DROP POLICY IF EXISTS "Admins can delete ad_angles" ON ad_angles;
CREATE POLICY "Authenticated users can read ad_angles"
  ON ad_angles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can insert ad_angles"
  ON ad_angles FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update ad_angles"
  ON ad_angles FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can delete ad_angles"
  ON ad_angles FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS "Authenticated users can read ad_angle_images" ON ad_angle_images;
DROP POLICY IF EXISTS "Admins can insert ad_angle_images" ON ad_angle_images;
DROP POLICY IF EXISTS "Admins can update ad_angle_images" ON ad_angle_images;
DROP POLICY IF EXISTS "Admins can delete ad_angle_images" ON ad_angle_images;
CREATE POLICY "Authenticated users can read ad_angle_images"
  ON ad_angle_images FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can insert ad_angle_images"
  ON ad_angle_images FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update ad_angle_images"
  ON ad_angle_images FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can delete ad_angle_images"
  ON ad_angle_images FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS "Admins have full access to users" ON users;
DROP POLICY IF EXISTS "Users can read their own record" ON users;
DROP POLICY IF EXISTS "Users can update their own tokens" ON users;
CREATE POLICY "Admins have full access to users"
  ON users FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Users can read their own record"
  ON users FOR SELECT USING (email = auth.email());
CREATE POLICY "Users can update their own tokens"
  ON users FOR UPDATE USING (email = auth.email()) WITH CHECK (email = auth.email());

DROP POLICY IF EXISTS "Admins have full access to generated_posts" ON generated_posts;
DROP POLICY IF EXISTS "Users can read their brand's posts" ON generated_posts;
DROP POLICY IF EXISTS "Users can insert posts for their brand" ON generated_posts;
DROP POLICY IF EXISTS "Users can delete their brand's posts" ON generated_posts;
CREATE POLICY "Admins have full access to generated_posts"
  ON generated_posts FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Users can read their brand's posts"
  ON generated_posts FOR SELECT USING (brand_id::text = my_brand_id());
CREATE POLICY "Users can insert posts for their brand"
  ON generated_posts FOR INSERT WITH CHECK (brand_id::text = my_brand_id());
CREATE POLICY "Users can delete their brand's posts"
  ON generated_posts FOR DELETE USING (brand_id::text = my_brand_id());

DROP POLICY IF EXISTS "Admins have full access to ppt_jobs" ON ppt_jobs;
DROP POLICY IF EXISTS "Users can read their brand's ppt jobs" ON ppt_jobs;
DROP POLICY IF EXISTS "Users can read their own ppt jobs" ON ppt_jobs;
DROP POLICY IF EXISTS "Users can insert ppt jobs for their brand" ON ppt_jobs;
CREATE POLICY "Admins have full access to ppt_jobs"
  ON ppt_jobs FOR ALL USING (is_admin()) WITH CHECK (is_admin());
-- Normal users only see decks they personally generated (not admin/test runs for their brand)
CREATE POLICY "Users can read their own ppt jobs"
  ON ppt_jobs FOR SELECT USING (created_by = auth.uid() AND NOT is_admin());
CREATE POLICY "Users can insert ppt jobs for their brand"
  ON ppt_jobs FOR INSERT WITH CHECK (brand_id::text = my_brand_id() OR is_admin());

DROP POLICY IF EXISTS "Authenticated users can read banner_templates" ON banner_templates;
DROP POLICY IF EXISTS "Admins can modify banner_templates" ON banner_templates;
CREATE POLICY "Authenticated users can read banner_templates"
  ON banner_templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can modify banner_templates"
  ON banner_templates FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Authenticated users can read ppt_layouts" ON ppt_layouts;
DROP POLICY IF EXISTS "Admins can modify ppt_layouts" ON ppt_layouts;
CREATE POLICY "Authenticated users can read ppt_layouts"
  ON ppt_layouts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can modify ppt_layouts"
  ON ppt_layouts FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Authenticated users can read carousel_layouts" ON carousel_layouts;
DROP POLICY IF EXISTS "Admins can modify carousel_layouts" ON carousel_layouts;
CREATE POLICY "Authenticated users can read carousel_layouts"
  ON carousel_layouts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can modify carousel_layouts"
  ON carousel_layouts FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Authenticated users can read carousel_slide_prompts" ON carousel_slide_prompts;
DROP POLICY IF EXISTS "Admins can modify carousel_slide_prompts" ON carousel_slide_prompts;
CREATE POLICY "Authenticated users can read carousel_slide_prompts"
  ON carousel_slide_prompts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can modify carousel_slide_prompts"
  ON carousel_slide_prompts FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Authenticated users can read overlay_templates" ON overlay_templates;
DROP POLICY IF EXISTS "Admins can modify overlay_templates" ON overlay_templates;
CREATE POLICY "Authenticated users can read overlay_templates"
  ON overlay_templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can modify overlay_templates"
  ON overlay_templates FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Authenticated users can read infographic_layouts" ON infographic_layouts;
DROP POLICY IF EXISTS "Admins can modify infographic_layouts" ON infographic_layouts;
CREATE POLICY "Authenticated users can read infographic_layouts"
  ON infographic_layouts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can modify infographic_layouts"
  ON infographic_layouts FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Authenticated users can read blog_layouts" ON blog_layouts;
DROP POLICY IF EXISTS "Admins can modify blog_layouts" ON blog_layouts;
CREATE POLICY "Authenticated users can read blog_layouts"
  ON blog_layouts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can modify blog_layouts"
  ON blog_layouts FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Authenticated users can read broker_prompts" ON broker_prompts;
DROP POLICY IF EXISTS "Admins can modify broker_prompts" ON broker_prompts;
CREATE POLICY "Authenticated users can read broker_prompts"
  ON broker_prompts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can modify broker_prompts"
  ON broker_prompts FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins have full access to blog_jobs" ON blog_jobs;
DROP POLICY IF EXISTS "Users can read their brand's blog jobs" ON blog_jobs;
DROP POLICY IF EXISTS "Users can insert blog jobs for their brand" ON blog_jobs;
CREATE POLICY "Admins have full access to blog_jobs"
  ON blog_jobs FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Users can read their brand's blog jobs"
  ON blog_jobs FOR SELECT USING (brand_id::text = my_brand_id());
CREATE POLICY "Users can insert blog jobs for their brand"
  ON blog_jobs FOR INSERT WITH CHECK (brand_id::text = my_brand_id());

DROP POLICY IF EXISTS "Admins have full access to ad_concepts" ON ad_concepts;
DROP POLICY IF EXISTS "Users can read their brand's ad concepts" ON ad_concepts;
DROP POLICY IF EXISTS "Users can insert ad concepts for their brand" ON ad_concepts;
CREATE POLICY "Admins have full access to ad_concepts"
  ON ad_concepts FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Users can read their brand's ad concepts"
  ON ad_concepts FOR SELECT USING (brand_id::text = my_brand_id());
CREATE POLICY "Users can insert ad concepts for their brand"
  ON ad_concepts FOR INSERT WITH CHECK (brand_id::text = my_brand_id());

DROP POLICY IF EXISTS "Admins have full access to carousel_jobs" ON carousel_jobs;
DROP POLICY IF EXISTS "Users can read their brand's carousel jobs" ON carousel_jobs;
DROP POLICY IF EXISTS "Users can insert carousel jobs for their brand" ON carousel_jobs;
CREATE POLICY "Admins have full access to carousel_jobs"
  ON carousel_jobs FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Users can read their brand's carousel jobs"
  ON carousel_jobs FOR SELECT USING (brand_id::text = my_brand_id());
CREATE POLICY "Users can insert carousel jobs for their brand"
  ON carousel_jobs FOR INSERT WITH CHECK (brand_id::text = my_brand_id());

DROP POLICY IF EXISTS "Admins have full access to infographic_jobs" ON infographic_jobs;
DROP POLICY IF EXISTS "Users can read their brand's infographic jobs" ON infographic_jobs;
DROP POLICY IF EXISTS "Users can insert infographic jobs for their brand" ON infographic_jobs;
CREATE POLICY "Admins have full access to infographic_jobs"
  ON infographic_jobs FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Users can read their brand's infographic jobs"
  ON infographic_jobs FOR SELECT USING (brand_id::text = my_brand_id());
CREATE POLICY "Users can insert infographic jobs for their brand"
  ON infographic_jobs FOR INSERT WITH CHECK (brand_id::text = my_brand_id());

DROP POLICY IF EXISTS "Admins have full access to infographics" ON infographics;
DROP POLICY IF EXISTS "Users can read their brand's infographics" ON infographics;
DROP POLICY IF EXISTS "Users can update their brand's infographics" ON infographics;
CREATE POLICY "Admins have full access to infographics"
  ON infographics FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Users can read their brand's infographics"
  ON infographics FOR SELECT USING (brand_id::text = my_brand_id());
CREATE POLICY "Users can update their brand's infographics"
  ON infographics FOR UPDATE USING (brand_id::text = my_brand_id()) WITH CHECK (brand_id::text = my_brand_id());
