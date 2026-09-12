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
  Link,
  Hr,
  Row,
  Column,
} from "@react-email/components"

interface AdminCustomWorkEmailProps {
  fullName: string
  phoneNumber: string
  email: string
  category: string
  budget?: string
  description?: string
  referenceImageUrl?: string
  submissionTime: string
}

export const AdminCustomWorkEmail: React.FC<AdminCustomWorkEmailProps> = ({
  fullName = "John Doe",
  phoneNumber = "+1 234 567 8900",
  email = "john@example.com",
  category = "Ring",
  budget = "₹50,000",
  description = "Custom moissanite solitaire ring design with gold band.",
  referenceImageUrl = "",
  submissionTime = new Date().toLocaleString(),
}) => {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={headerSection}>
            <Text style={brandBadge}>Cultura Jewels</Text>
            <Heading style={heading}>New Custom Work Enquiry</Heading>
            <Text style={subheading}>Received from {fullName}</Text>
          </Section>

          <Hr style={hr} />

          {/* Details Table */}
          <Section style={contentSection}>
            <Text style={sectionTitle}>Customer & Project Details</Text>

            <Row style={row}>
              <Column style={labelCol}>
                <Text style={label}>Full Name:</Text>
              </Column>
              <Column style={valCol}>
                <Text style={value}>{fullName}</Text>
              </Column>
            </Row>

            <Row style={row}>
              <Column style={labelCol}>
                <Text style={label}>Email:</Text>
              </Column>
              <Column style={valCol}>
                <Link href={`mailto:${email}`} style={linkValue}>
                  {email}
                </Link>
              </Column>
            </Row>

            <Row style={row}>
              <Column style={labelCol}>
                <Text style={label}>Phone Number:</Text>
              </Column>
              <Column style={valCol}>
                <Link href={`tel:${phoneNumber}`} style={linkValue}>
                  {phoneNumber}
                </Link>
              </Column>
            </Row>

            <Row style={row}>
              <Column style={labelCol}>
                <Text style={label}>Category:</Text>
              </Column>
              <Column style={valCol}>
                <Text style={badgeValue}>{category}</Text>
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
                <Text style={label}>Submitted At:</Text>
              </Column>
              <Column style={valCol}>
                <Text style={value}>{submissionTime}</Text>
              </Column>
            </Row>

            <Section style={descriptionBox}>
              <Text style={label}>Description / Specifications:</Text>
              <Text style={descriptionText}>{description || "No description provided."}</Text>
            </Section>

            {/* Reference Image */}
            {referenceImageUrl ? (
              <Section style={imageBox}>
                <Text style={label}>Reference Image:</Text>
                <div style={imageContainer}>
                  <Img
                    src={referenceImageUrl}
                    alt="Reference Image"
                    width="100%"
                    style={previewImage}
                  />
                </div>
                <Text style={imageLinkText}>
                  Direct URL:{" "}
                  <Link href={referenceImageUrl} target="_blank" style={linkValue}>
                    View High-Res Image
                  </Link>
                </Text>
              </Section>
            ) : (
              <Section style={noImageBox}>
                <Text style={mutedText}>No reference image uploaded.</Text>
              </Section>
            )}
          </Section>

          <Hr style={hr} />

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              Cultura Jewels Admin Dashboard & Notification System
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default AdminCustomWorkEmail

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
  backgroundColor: "#0d1a11",
  padding: "32px 24px",
  textAlign: "center",
}

const brandBadge: React.CSSProperties = {
  color: "#D4AF37",
  fontSize: "12px",
  fontWeight: "bold",
  letterSpacing: "3px",
  textTransform: "uppercase",
  margin: "0 0 8px 0",
}

const heading: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "22px",
  fontWeight: "700",
  margin: "0 0 6px 0",
}

const subheading: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "14px",
  margin: "0",
}

const hr: React.CSSProperties = {
  borderColor: "#f1f5f9",
  margin: "0",
}

const contentSection: React.CSSProperties = {
  padding: "32px 28px",
}

const sectionTitle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: "16px",
  fontWeight: "700",
  marginBottom: "20px",
  textTransform: "uppercase",
  letterSpacing: "1px",
}

const row: React.CSSProperties = {
  marginBottom: "12px",
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
  fontSize: "14px",
  fontWeight: "500",
  color: "#1e293b",
  margin: "0",
}

const linkValue: React.CSSProperties = {
  fontSize: "14px",
  color: "#D4AF37",
  textDecoration: "underline",
  fontWeight: "500",
}

const badgeValue: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#fef3c7",
  color: "#92400e",
  padding: "3px 10px",
  borderRadius: "12px",
  fontSize: "12px",
  fontWeight: "700",
  margin: "0",
}

const descriptionBox: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  padding: "16px",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
  marginTop: "20px",
}

const descriptionText: React.CSSProperties = {
  fontSize: "14px",
  color: "#334155",
  marginTop: "8px",
  lineHeight: "1.5",
  whiteSpace: "pre-wrap",
}

const imageBox: React.CSSProperties = {
  marginTop: "24px",
}

const imageContainer: React.CSSProperties = {
  marginTop: "10px",
  borderRadius: "8px",
  overflow: "hidden",
  border: "1px solid #cbd5e1",
  maxHeight: "350px",
}

const previewImage: React.CSSProperties = {
  display: "block",
  objectFit: "contain",
  maxHeight: "350px",
}

const imageLinkText: React.CSSProperties = {
  fontSize: "12px",
  color: "#64748b",
  marginTop: "8px",
}

const noImageBox: React.CSSProperties = {
  marginTop: "20px",
  padding: "12px",
  backgroundColor: "#f8fafc",
  borderRadius: "8px",
}

const mutedText: React.CSSProperties = {
  fontSize: "13px",
  color: "#94a3b8",
  margin: "0",
  fontStyle: "italic",
}

const footerSection: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  padding: "20px 24px",
  textAlign: "center",
}

const footerText: React.CSSProperties = {
  fontSize: "12px",
  color: "#94a3b8",
  margin: "0",
}
