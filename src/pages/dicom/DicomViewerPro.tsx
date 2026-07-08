import DicomViewerProComponent from '../../components/dicom/DicomViewerPro'
import ViewerSelector from '../../components/common/ViewerSelector'

export default function DicomViewerProPage() {
  return (
    <>
      <ViewerSelector current="pro" />
      <DicomViewerProComponent height={window.innerHeight - 100} />
    </>
  )
}
