import * as React from "react"
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Img,
  Hr,
  Row,
  Column,
} from "@react-email/components"

interface CustomerConfirmationEmailProps {
  fullName: string
  category: string
  budget?: string
  description?: string
  referenceImageUrl?: string
  logoUrl?: string
}

export const CustomerConfirmationEmail: React.FC<CustomerConfirmationEmailProps> = ({
  fullName = "Valued Customer",
  category = "Ring",
  budget = "₹50,000",
  description = "Custom moissanite ring design",
  referenceImageUrl = "",
  logoUrl = process.env.NEXT_PUBLIC_LOGO_URL || "",
}) => {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          {/* Top Logo / Header */}
          <Section style={headerSection}>
            {logoUrl ? (
              <Img src={logoUrl} alt="Cultura Jewels" width="160" style={logoImage} />
            ) : (
              <Text style={logoText}>CULTURA JEWELS</Text>
            )}
            <Text style={tagline}>Bespoke Fine Jewelry & Artisan Crafts</Text>
          </Section>

          {/* Banner */}
          <Section style={bannerSection}>
            <Heading style={bannerHeading}>Request Received</Heading>
            <Text style={bannerSubhead}>Thank you for choosing Cultura Jewels</Text>
          </Section>

          {/* Content */}
          <Section style={contentSection}>
            <Text style={greeting}>Dear {fullName},</Text>
            <Text style={paragraph}>
              Thank you for sharing your vision with us! We have successfully received your custom jewelry request.
              Our master artisans and design team are reviewing your specifications and will craft a personalized recommendation for you.
            </Text>

            {/* SLA Badge */}
            <Section style={slaBox}>
              <Text style={slaBadgeTitle}>⏱️ Expected Response Time</Text>
              <Text style={slaBadgeText}>
                Our team will reach out to you on your email or phone within <strong>24 to 48 hours</strong> with initial design concepts and estimated pricing.
              </Text>
            </Section>

            {/* Submission Summary */}
            <Section style={summaryBox}>
              <Text style={summaryTitle}>Summary of Your Request</Text>

              <Row style={row}>
                <Column style={labelCol}>
                  <Text style={label}>Category:</Text>
                </Column>
                <Column style={valCol}>
                  <Text style={value}>{category}</Text>
                </Column>
              </Row>

              <Row style={row}>
                <Column style={labelCol}>
                  <Text style={label}>Budget:</Text>
                </Column>
                <Column style={valCol}>
                  <Text style={value}>{budget || "Not Specified"}</Text>
                </Column>
              </Row>

              <Row style={row}>
                <Column style={labelCol}>
                  <Text style={label}>Specifications:</Text>
                </Column>
                <Column style={valCol}>
                  <Text style={value}>{description || "None provided"}</Text>
                </Column>
              </Row>

              {referenceImageUrl && (
                <Row style={row}>
                  <Column style={labelCol}>
                    <Text style={label}>Reference Image:</Text>
                  </Column>
                  <Column style={valCol}>
                    <Text style={value}>Attached & Received ✓</Text>
                  </Column>
                </Row>
              )}
            </Section>

            <Text style={paragraph}>
              If you have any additional details or design inspirations to add, feel free to reply directly to this email or reach out to us at support@culturajewels.com.
            </Text>

            <Text style={signoff}>
              Warm regards,<br />
              <strong>The Cultura Jewels Artisan Team</strong>
            </Text>
          </Section>

          <Hr style={hr} />

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerBrand}>CULTURA JEWELS</Text>
            <Text style={footerText}>
              Handcrafted Bespoke Jewelry | Premium Craftsmanship
            </Text>
            <Text style={footerLegal}>
              © {new Date().getFullYear()} Cultura Jewels. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default CustomerConfirmationEmail

// Styles
const main: React.CSSProperties = {
  backgroundColor: "#f4f5f7",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  padding: "40px 10px",
}

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  borderRadius: "12px",
  overflow: "hidden",
  maxWidth: "600px",
  boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
  border: "1px solid #e2e8f0",
}

const headerSection: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "24px",
  textAlign: "center",
  borderBottom: "1px solid #f1f5f9",
}

const logoImage: React.CSSProperties = {
  margin: "0 auto",
  display: "block",
}

const logoText: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: "800",
  letterSpacing: "4px",
  color: "#102a43",
  margin: "0",
}

const tagline: React.CSSProperties = {
  fontSize: "11px",
  color: "#D4AF37",
  letterSpacing: "2px",
  textTransform: "uppercase",
  margin: "6px 0 0 0",
}

const bannerSection: React.CSSProperties = {
  backgroundColor: "#0d1a11",
  padding: "28px 24px",
  textAlign: "center",
}

const bannerHeading: React.CSSProperties = {
  color: "#D4AF37",
  fontSize: "24px",
  fontWeight: "700",
  margin: "0 0 6px 0",
  letterSpacing: "1px",
}

const bannerSubhead: React.CSSProperties = {
  color: "#e2e8f0",
  fontSize: "13px",
  margin: "0",
}

const contentSection: React.CSSProperties = {
  padding: "32px 28px",
}

const greeting: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "700",
  color: "#0f172a",
  marginBottom: "14px",
}

const paragraph: React.CSSProperties = {
  fontSize: "14px",
  color: "#334155",
  lineHeight: "1.6",
  marginBottom: "20px",
}

const slaBox: React.CSSProperties = {
  backgroundColor: "#fffbeb",
  border: "1px solid #fef3c7",
  borderRadius: "10px",
  padding: "16px",
  marginBottom: "24px",
}

const slaBadgeTitle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: "700",
  color: "#92400e",
  margin: "0 0 6px 0",
}

const slaBadgeText: React.CSSProperties = {
  fontSize: "13px",
  color: "#78350f",
  margin: "0",
  lineHeight: "1.5",
}

const summaryBox: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  borderRadius: "10px",
  border: "1px solid #e2e8f0",
  padding: "20px",
  marginBottom: "24px",
}

const summaryTitle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "700",
  color: "#0f172a",
  marginBottom: "14px",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
}

const row: React.CSSProperties = {
  marginBottom: "10px",
}

const labelCol: React.CSSProperties = {
  width: "35%",
  verticalAlign: "top",
}

const valCol: React.CSSProperties = {
  width: "65%",
  verticalAlign: "top",
}

const label: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: "600",
  color: "#64748b",
  margin: "0",
}

const value: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: "500",
  color: "#1e293b",
  margin: "0",
}

const signoff: React.CSSProperties = {
  fontSize: "14px",
  color: "#334155",
  lineHeight: "1.6",
  marginTop: "28px",
}

const hr: React.CSSProperties = {
  borderColor: "#f1f5f9",
  margin: "0",
}

const footerSection: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  padding: "24px",
  textAlign: "center",
}

const footerBrand: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: "700",
  letterSpacing: "2px",
  color: "#102a43",
  margin: "0 0 4px 0",
}

const footerText: React.CSSProperties = {
  fontSize: "11px",
  color: "#64748b",
  margin: "0 0 8px 0",
}

const footerLegal: React.CSSProperties = {
  fontSize: "10px",
  color: "#94a3b8",
  margin: "0",
}
